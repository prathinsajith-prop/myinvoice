import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Features — MyInvoice AE",
    description: "Explore all features of MyInvoice AE: invoicing, VAT returns, expense tracking, multi-currency support, and more.",
};

import { FileText, Shield, Globe, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
    {
        icon: FileText,
        title: "Invoice and Quote Workflows",
        description: "Create tax invoices, quotations, bills, and expenses with fast line item editing and document numbering.",
    },
    {
        icon: Shield,
        title: "UAE VAT Support",
        description: "FTA-ready VAT calculations, returns preview, and invoice QR payload generation for compliance workflows.",
    },
    {
        icon: Globe,
        title: "Arabic + English",
        description: "Language toggle with Arabic RTL layout support for teams and customers in the UAE market.",
    },
    {
        icon: Zap,
        title: "Automation",
        description: "Email invoice sending, PDF generation, customer portal links, and Stripe payment links from invoice detail pages.",
    },
];

export default function FeaturesPage() {
    return (
        <div className="container mx-auto max-w-6xl px-4 py-14 space-y-10">
            <div className="space-y-3 text-center">
                <h1 className="text-4xl font-bold tracking-tight">Platform Features</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Built for UAE small and mid-size businesses that need practical, compliant, and fast invoicing operations.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {features.map((item) => (
                    <div key={item.title} className="rounded-xl border bg-card p-6">
                        <item.icon className="h-8 w-8 text-primary" />
                        <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                ))}
            </div>

            <div className="flex justify-center gap-3">
                <Button asChild>
                    <Link href="/register" className="gap-2">Start Free Trial <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/pricing">View Pricing</Link>
                </Button>
            </div>
        </div>
    );
}
