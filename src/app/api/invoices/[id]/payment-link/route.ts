import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getStripeServer } from "@/lib/stripe/server";
import { APP_URL, STRIPE_SECRET_KEY } from "@/lib/constants/env";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        if (!STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: "Online payments are not configured for this account." },
                { status: 400 }
            );
        }

        // Try to get authenticated context first
        let organizationId: string;
        let isPublicPortal = false;

        try {
            const ctx = await resolveApiContext(req);
            organizationId = ctx.organizationId;
        } catch {
            // Fall back to public portal payment (use publicToken from query)
            const publicToken = req.nextUrl.searchParams.get("token");

            if (!publicToken) {
                throw new UnauthorizedError("Payment link requires authentication or valid public token");
            }

            isPublicPortal = true;

            // Verify the invoice exists and has this public token
            const invoiceWithToken = await prisma.invoice.findFirst({
                where: { id, publicToken, deletedAt: null },
            });

            if (!invoiceWithToken) {
                throw new NotFoundError("Invoice or invalid token");
            }

            organizationId = invoiceWithToken.organizationId;
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: {
                customer: { select: { id: true, name: true, email: true } },
                organization: { select: { name: true, stripeSecretKeyHash: true } },
            },
        });

        if (!invoice) throw new NotFoundError("Invoice");
        if (Number(invoice.outstanding) <= 0) {
            return NextResponse.json({ error: "Invoice is already fully paid" }, { status: 400 });
        }

        // Get payment amount (default to outstanding, or use custom amount)
        const amountParam = req.nextUrl.searchParams.get("amount");
        let paymentAmount = Number(invoice.outstanding);

        if (amountParam) {
            const customAmount = parseFloat(amountParam);
            if (isNaN(customAmount) || customAmount < 0.01) {
                return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
            }
            if (customAmount > Number(invoice.outstanding)) {
                return NextResponse.json({ error: "Payment amount exceeds outstanding balance" }, { status: 400 });
            }
            paymentAmount = customAmount;
        }

        const stripe = getStripeServer();
        const appUrl = APP_URL || req.nextUrl.origin;

        // Determine redirect URLs based on whether this is a public portal payment
        const successUrl = isPublicPortal
            ? `${appUrl}/portal/${invoice.publicToken}?payment=success`
            : `${appUrl}/invoices/${invoice.id}?payment=success`;

        const cancelUrl = isPublicPortal
            ? `${appUrl}/portal/${invoice.publicToken}?payment=cancelled`
            : `${appUrl}/invoices/${invoice.id}?payment=cancelled`;

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: invoice.customer.email || undefined,
            metadata: {
                kind: "invoice_payment",
                invoiceId: invoice.id,
                organizationId: organizationId,
                isPublicPortal: isPublicPortal ? "true" : "false",
            },
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: invoice.currency.toLowerCase(),
                        unit_amount: Math.round(paymentAmount * 100),
                        product_data: {
                            name: `Invoice ${invoice.invoiceNumber}`,
                            description: `Payment for ${invoice.customer.name}`,
                        },
                    },
                },
            ],
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        return toErrorResponse(error);
    }
}
