import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithRole } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { getStripeServer } from "@/lib/stripe/server";

const schema = z.object({
    plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
});

const PRICE_ENV_MAP: Record<string, string | undefined> = {
    STARTER: process.env.STRIPE_PRICE_STARTER,
    PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL,
    ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
};

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContextWithRole(req, "ADMIN");
        const payload = schema.safeParse(await req.json());

        if (!payload.success) {
            return NextResponse.json(
                { error: "Validation failed", details: payload.error.flatten() },
                { status: 400 }
            );
        }

        const priceId = PRICE_ENV_MAP[payload.data.plan];
        if (!priceId) {
            return NextResponse.json(
                { error: `Stripe price for ${payload.data.plan} is not configured` },
                { status: 400 }
            );
        }

        const organization = await prisma.organization.findUnique({
            where: { id: ctx.organizationId },
            include: { subscription: true },
        });

        if (!organization?.subscription) {
            return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
        }

        const stripe = getStripeServer();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

        let customerId = organization.subscription.stripeCustomerId || undefined;
        if (!customerId) {
            const customer = await stripe.customers.create({
                name: organization.legalName || organization.name,
                email: organization.email || undefined,
                metadata: { organizationId: organization.id },
            });
            customerId = customer.id;
            await prisma.subscription.update({
                where: { organizationId: organization.id },
                data: { stripeCustomerId: customerId },
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            success_url: `${appUrl}/settings/billing?upgrade=success`,
            cancel_url: `${appUrl}/settings/billing?upgrade=cancelled`,
            line_items: [{ price: priceId, quantity: 1 }],
            metadata: {
                kind: "subscription_upgrade",
                organizationId: organization.id,
                plan: payload.data.plan,
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        return toErrorResponse(error);
    }
}
