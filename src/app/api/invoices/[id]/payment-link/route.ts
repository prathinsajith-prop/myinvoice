import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { getStripeServer } from "@/lib/stripe/server";
import { APP_URL, STRIPE_SECRET_KEY } from "@/lib/constants/env";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        if (!STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: "Online payments are not configured for this account." },
                { status: 400 }
            );
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: { customer: { select: { id: true, name: true, email: true } } },
        });

        if (!invoice) throw new NotFoundError("Invoice");
        if (Number(invoice.outstanding) <= 0) {
            return NextResponse.json({ error: "Invoice is already fully paid" }, { status: 400 });
        }

        const stripe = getStripeServer();
        const appUrl = APP_URL || req.nextUrl.origin;

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            success_url: `${appUrl}/invoices/${invoice.id}?payment=success`,
            cancel_url: `${appUrl}/invoices/${invoice.id}?payment=cancelled`,
            customer_email: invoice.customer.email || undefined,
            metadata: {
                kind: "invoice_payment",
                invoiceId: invoice.id,
                organizationId: ctx.organizationId,
            },
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: invoice.currency.toLowerCase(),
                        unit_amount: Math.round(Number(invoice.outstanding) * 100),
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
