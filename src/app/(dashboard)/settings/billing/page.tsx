"use client";

import { useState, useEffect } from "react";
import {
    CreditCard,
    CheckCircle2,
    Zap,
    Users,
    FileText,
    HardDrive,
    AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SubscriptionPlan = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";

interface SubscriptionData {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    monthlyInvoiceLimit: number;
    teamMemberLimit: number;
    storageGbLimit: number;
    customersLimit: number;
    hasApiAccess: boolean;
    hasCustomBranding: boolean;
    hasAdvancedReports: boolean;
    hasMultiCurrency: boolean;
    hasWhiteLabel: boolean;
}

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
    FREE: "Free",
    STARTER: "Starter",
    PROFESSIONAL: "Professional",
    ENTERPRISE: "Enterprise",
};

const PLAN_PRICES: Record<SubscriptionPlan, string> = {
    FREE: "Free forever",
    STARTER: "AED 49 / month",
    PROFESSIONAL: "AED 149 / month",
    ENTERPRISE: "Custom pricing",
};

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    TRIALING: { label: "Trial", variant: "secondary" },
    ACTIVE: { label: "Active", variant: "default" },
    PAST_DUE: { label: "Past Due", variant: "destructive" },
    CANCELED: { label: "Canceled", variant: "outline" },
    PAUSED: { label: "Paused", variant: "secondary" },
};

function FeatureRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{label}</span>
            </div>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

function BoolFeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
    return (
        <div className="flex items-center justify-between py-3">
            <span className="text-sm">{label}</span>
            {enabled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
                <span className="text-xs text-muted-foreground">Not included</span>
            )}
        </div>
    );
}

const UPGRADE_PLANS: { plan: SubscriptionPlan; price: string; highlights: string[] }[] = [
    {
        plan: "STARTER",
        price: "AED 49/mo",
        highlights: ["100 invoices/month", "5 team members", "10 GB storage", "500 customers"],
    },
    {
        plan: "PROFESSIONAL",
        price: "AED 149/mo",
        highlights: ["Unlimited invoices", "15 team members", "50 GB storage", "Custom branding", "API access"],
    },
    {
        plan: "ENTERPRISE",
        price: "Custom",
        highlights: ["Unlimited everything", "White label", "Dedicated support", "Custom integrations"],
    },
];

export default function BillingSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

    useEffect(() => {
        fetch("/api/organization")
            .then((r) => r.json())
            .then((json) => {
                setSubscription(json.organization?.subscription ?? null);
            })
            .catch(() => toast.error("Failed to load billing information"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-56 w-full" />
            </div>
        );
    }

    if (!subscription) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    No subscription data found. Please contact support.
                </AlertDescription>
            </Alert>
        );
    }

    const statusInfo = STATUS_BADGE[subscription.status];
    const isTrialing = subscription.status === "TRIALING";
    const trialEnd = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
    const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
    const isFree = subscription.plan === "FREE";

    const daysUntilTrialEnd = trialEnd
        ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    return (
        <div className="space-y-6">
            {/* Current Plan */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <CardTitle>Current Plan</CardTitle>
                    </div>
                    <CardDescription>Your active subscription and usage limits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <p className="text-xl font-bold">{PLAN_LABELS[subscription.plan]}</p>
                                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {PLAN_PRICES[subscription.plan]}
                            </p>
                            {isTrialing && daysUntilTrialEnd !== null && (
                                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                    Trial ends in {daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? "s" : ""}
                                    {trialEnd ? ` (${trialEnd.toLocaleDateString()})` : ""}
                                </p>
                            )}
                            {periodEnd && !isTrialing && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {subscription.cancelAtPeriodEnd
                                        ? `Cancels on ${periodEnd.toLocaleDateString()}`
                                        : `Renews on ${periodEnd.toLocaleDateString()}`}
                                </p>
                            )}
                        </div>
                        {!isFree && (
                            <Button variant="outline" disabled>
                                Manage Billing
                            </Button>
                        )}
                    </div>

                    <Separator />

                    <div className="divide-y">
                        <FeatureRow
                            icon={FileText}
                            label="Monthly Invoices"
                            value={subscription.monthlyInvoiceLimit === -1 ? "Unlimited" : String(subscription.monthlyInvoiceLimit)}
                        />
                        <FeatureRow
                            icon={Users}
                            label="Team Members"
                            value={subscription.teamMemberLimit === -1 ? "Unlimited" : String(subscription.teamMemberLimit)}
                        />
                        <FeatureRow
                            icon={HardDrive}
                            label="Storage"
                            value={`${subscription.storageGbLimit} GB`}
                        />
                        <FeatureRow
                            icon={Users}
                            label="Customers"
                            value={subscription.customersLimit === -1 ? "Unlimited" : String(subscription.customersLimit)}
                        />
                    </div>

                    <Separator />

                    <div className="divide-y">
                        <BoolFeatureRow label="API Access" enabled={subscription.hasApiAccess} />
                        <BoolFeatureRow label="Custom Branding" enabled={subscription.hasCustomBranding} />
                        <BoolFeatureRow label="Advanced Reports" enabled={subscription.hasAdvancedReports} />
                        <BoolFeatureRow label="Multi-Currency" enabled={subscription.hasMultiCurrency} />
                        <BoolFeatureRow label="White Label" enabled={subscription.hasWhiteLabel} />
                    </div>
                </CardContent>
            </Card>

            {/* Upgrade Plans (shown when not on Enterprise) */}
            {subscription.plan !== "ENTERPRISE" && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <CardTitle>Upgrade Your Plan</CardTitle>
                        </div>
                        <CardDescription>
                            Unlock more features and higher limits
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {UPGRADE_PLANS.filter((p) => {
                                const order: SubscriptionPlan[] = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"];
                                return order.indexOf(p.plan) > order.indexOf(subscription.plan);
                            }).map((p) => (
                                <div
                                    key={p.plan}
                                    className={`rounded-lg border p-4 space-y-3 ${p.plan === "PROFESSIONAL"
                                            ? "border-primary bg-primary/5"
                                            : ""
                                        }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold">{PLAN_LABELS[p.plan]}</p>
                                            {p.plan === "PROFESSIONAL" && (
                                                <Badge variant="default" className="text-xs">Popular</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{p.price}</p>
                                    </div>
                                    <ul className="space-y-1">
                                        {p.highlights.map((h) => (
                                            <li key={h} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                                {h}
                                            </li>
                                        ))}
                                    </ul>
                                    <Button
                                        size="sm"
                                        variant={p.plan === "PROFESSIONAL" ? "default" : "outline"}
                                        className="w-full"
                                        disabled
                                    >
                                        {p.plan === "ENTERPRISE" ? "Contact Sales" : "Upgrade"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <p className="mt-4 text-center text-xs text-muted-foreground">
                            Payment processing coming soon. Contact us at{" "}
                            <a href="mailto:billing@myinvoice.ae" className="underline underline-offset-2">
                                billing@myinvoice.ae
                            </a>{" "}
                            to upgrade.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
