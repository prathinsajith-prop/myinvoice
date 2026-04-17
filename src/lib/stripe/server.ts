import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "@/lib/constants/env";

let stripeClient: Stripe | null = null;

export function getStripeServer() {
    const secret = STRIPE_SECRET_KEY;
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
