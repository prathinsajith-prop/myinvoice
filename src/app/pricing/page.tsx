import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Pricing — MyInvoice AE",
    description: "Simple, transparent pricing for MyInvoice AE. Choose the plan that fits your business.",
};

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
    {
        name: "Free",
        price: "AED 0",
        desc: "For solo founders",
        items: ["10 invoices / month", "1 team member", "Basic reports"],
    },
    {
        name: "Starter",
        price: "AED 49",
        desc: "For growing teams",
        items: ["100 invoices / month", "5 team members", "Email invoice send", "VAT summary"],
    },
    {
        name: "Professional",
        price: "AED 149",
        desc: "For scale",
        items: ["Unlimited invoices", "Advanced reports", "Stripe payment links", "Priority support"],
    },
];

export default function PricingPage() {
    return (
        <div className="container mx-auto max-w-6xl px-4 py-14 space-y-10">
            <div className="text-center space-y-3">
                <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
                <p className="text-muted-foreground">Simple monthly plans. All prices are in AED.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {plans.map((plan) => (
                    <div key={plan.name} className="rounded-xl border bg-card p-6">
                        <h2 className="text-2xl font-semibold">{plan.name}</h2>
                        <p className="mt-1 text-muted-foreground text-sm">{plan.desc}</p>
                        <p className="mt-4 text-3xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground"> /month</span></p>
                        <ul className="mt-5 space-y-2 text-sm">
                            {plan.items.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <Button className="mt-6 w-full" asChild>
                            <Link href="/register">Choose {plan.name}</Link>
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
