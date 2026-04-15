import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeServer() {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    if (!stripeClient) {
        stripeClient = new Stripe(secret, {
            apiVersion: "2026-03-25.dahlia",
        });
    }

    return stripeClient;
}
