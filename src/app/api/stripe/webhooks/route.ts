import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { getStripeServer } from "@/lib/stripe/server";
import { STRIPE_WEBHOOK_SECRET } from "@/lib/constants/env";

export async function POST(req: NextRequest) {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        return NextResponse.json({ error: "Webhook signature is missing" }, { status: 400 });
    }

    const stripe = getStripeServer();
    const payload = await req.text();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
        return NextResponse.json({ error: `Webhook signature verification failed: ${String(error)}` }, { status: 400 });
    }

    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const kind = session.metadata?.kind;

            if (kind === "invoice_payment" && session.metadata?.invoiceId && session.metadata?.organizationId) {
                const invoice = await prisma.invoice.findFirst({
                    where: {
                        id: session.metadata.invoiceId,
                        organizationId: session.metadata.organizationId,
                        deletedAt: null,
                    },
                    select: { id: true, organizationId: true, customerId: true, invoiceNumber: true, outstanding: true, status: true },
                });

                if (invoice) {
                    const amount = Number(session.amount_total || 0) / 100;
                    if (amount > 0) {
                        // Derive a consistent transaction ID the same way we store it
                        const txnId = String(session.payment_intent || session.id);
                        const existingPayment = await prisma.payment.findFirst({
                            where: { gatewayTransactionId: txnId },
                            select: { id: true },
                        });

                        if (!existingPayment) {
                            const newOutstanding = Math.max(0, Number(invoice.outstanding) - amount);
                            const newStatus =
                                newOutstanding <= 0.01
                                    ? "PAID"
                                    : newOutstanding < Number(invoice.outstanding)
                                        ? "PARTIALLY_PAID"
                                        : invoice.status;

                            await prisma.$transaction(async (tx) => {
                                // Serialize payment number generation per organization.
                                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pay:${invoice.organizationId}`}))`;

                                // Generate payment number atomically inside the transaction
                                const lastPayment = await tx.payment.findFirst({
                                    where: { organizationId: invoice.organizationId },
                                    orderBy: { createdAt: "desc" },
                                    select: { paymentNumber: true },
                                });
                                const nextNum = lastPayment?.paymentNumber
                                    ? String(Number(lastPayment.paymentNumber.replace(/[^0-9]/g, "")) + 1).padStart(4, "0")
                                    : "0001";
                                const paymentNumber = `PAY-${nextNum}`;

                                await tx.payment.create({
                                    data: {
                                        organizationId: invoice.organizationId,
                                        customerId: invoice.customerId,
                                        paymentNumber,
                                        method: "STRIPE",
                                        status: "COMPLETED",
                                        amount,
                                        amountNet: amount,
                                        bankCharge: 0,
                                        paymentDate: new Date(),
                                        gatewayTransactionId: txnId,
                                        gatewayResponse: session as unknown as object,
                                        allocations: {
                                            create: {
                                                invoiceId: invoice.id,
                                                amount,
                                            },
                                        },
                                    },
                                });
                                await tx.invoice.update({
                                    where: { id: invoice.id },
                                    data: {
                                        amountPaid: { increment: amount },
                                        outstanding: newOutstanding,
                                        status: newStatus,
                                        ...(newStatus === "PAID" ? { paidAt: new Date() } : {}),
                                    },
                                });
                            });
                        }
                    }
                }
            }

            if (kind === "subscription_upgrade" && session.metadata?.organizationId && session.metadata?.plan) {
                await prisma.subscription.update({
                    where: { organizationId: session.metadata.organizationId },
                    data: {
                        plan: session.metadata.plan as "STARTER" | "PROFESSIONAL" | "ENTERPRISE",
                        status: "ACTIVE",
                        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
                        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
                    },
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook handler failed:", error);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}
