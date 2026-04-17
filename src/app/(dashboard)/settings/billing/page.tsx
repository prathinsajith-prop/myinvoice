"use client";

import { useState } from "react";
import useSWR from "swr";
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
import { useTranslations } from "next-intl";

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
import { jsonFetcher } from "@/lib/fetcher";

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

interface BillingResponse {
    organization?: {
        subscription?: SubscriptionData | null;
    };
}

const STATUS_VARIANT: Record<SubscriptionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    TRIALING: "secondary",
    ACTIVE: "default",
    PAST_DUE: "destructive",
    CANCELED: "outline",
    PAUSED: "secondary",
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

function BoolFeatureRow({ label, enabled, notIncludedText }: { label: string; enabled: boolean; notIncludedText: string }) {
    return (
        <div className="flex items-center justify-between py-3">
            <span className="text-sm">{label}</span>
            {enabled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
                <span className="text-xs text-muted-foreground">{notIncludedText}</span>
            )}
        </div>
    );
}

const UPGRADE_PLANS: { plan: SubscriptionPlan; priceKey: string; highlightKeys: string[] }[] = [
    {
        plan: "STARTER",
        priceKey: "AED 49/mo",
        highlightKeys: ["highlight_100invoices", "highlight_5members", "highlight_10gb", "highlight_500customers"],
    },
    {
        plan: "PROFESSIONAL",
        priceKey: "AED 149/mo",
        highlightKeys: ["highlight_unlimitedInvoices", "highlight_15members", "highlight_50gb", "highlight_customBranding", "highlight_apiAccess"],
    },
    {
        plan: "ENTERPRISE",
        priceKey: "Custom",
        highlightKeys: ["highlight_unlimitedEverything", "highlight_whiteLabel", "highlight_dedicatedSupport", "highlight_customIntegrations"],
    },
];

export default function BillingSettingsPage() {
    const t = useTranslations("settings.billing");
    const [upgradingPlan, setUpgradingPlan] = useState<SubscriptionPlan | null>(null);
    const { data, isLoading: loading } = useSWR<BillingResponse>("/api/organization", jsonFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        onError() {
            toast.error(t("failedToLoad"));
        },
    });
    const subscription = data?.organization?.subscription ?? null;

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
                    {t("noSubscription")}
                </AlertDescription>
            </Alert>
        );
    }

    const statusVariant = STATUS_VARIANT[subscription.status];
    const isTrialing = subscription.status === "TRIALING";
    const trialEnd = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
    const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
    const isFree = subscription.plan === "FREE";

    async function handleUpgrade(plan: SubscriptionPlan) {
        setUpgradingPlan(plan);
        try {
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Unable to start checkout");
            if (!data.url) throw new Error("No checkout URL returned");

            window.location.href = data.url;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("failedToUpgrade"));
            setUpgradingPlan(null);
        }
    }

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
                        <CardTitle>{t("currentPlan")}</CardTitle>
                    </div>
                    <CardDescription>{t("currentPlanDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <p className="text-xl font-bold">{t(`planLabels.${subscription.plan}`)}</p>
                                <Badge variant={statusVariant}>{t(`statusLabels.${subscription.status}`)}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t(`planPrices.${subscription.plan}`)}
                            </p>
                            {isTrialing && daysUntilTrialEnd !== null && (
                                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                    {t("trialEndsIn", { days: daysUntilTrialEnd })}
                                    {trialEnd ? ` (${trialEnd.toLocaleDateString()})` : ""}
                                </p>
                            )}
                            {periodEnd && !isTrialing && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {subscription.cancelAtPeriodEnd
                                        ? t("cancelsOn", { date: periodEnd.toLocaleDateString() })
                                        : t("renewsOn", { date: periodEnd.toLocaleDateString() })}
                                </p>
                            )}
                        </div>
                        {!isFree && (
                            <Button variant="outline" asChild>
                                <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
                                    {t("manageBilling")}
                                </a>
                            </Button>
                        )}
                    </div>

                    <Separator />

                    <div className="divide-y">
                        <FeatureRow
                            icon={FileText}
                            label={t("monthlyInvoices")}
                            value={subscription.monthlyInvoiceLimit === -1 ? t("unlimited") : String(subscription.monthlyInvoiceLimit)}
                        />
                        <FeatureRow
                            icon={Users}
                            label={t("teamMembers")}
                            value={subscription.teamMemberLimit === -1 ? t("unlimited") : String(subscription.teamMemberLimit)}
                        />
                        <FeatureRow
                            icon={HardDrive}
                            label={t("storage")}
                            value={`${subscription.storageGbLimit} GB`}
                        />
                        <FeatureRow
                            icon={Users}
                            label={t("customers")}
                            value={subscription.customersLimit === -1 ? t("unlimited") : String(subscription.customersLimit)}
                        />
                    </div>

                    <Separator />

                    <div className="divide-y">
                        <BoolFeatureRow label={t("apiAccess")} enabled={subscription.hasApiAccess} notIncludedText={t("notIncluded")} />
                        <BoolFeatureRow label={t("customBranding")} enabled={subscription.hasCustomBranding} notIncludedText={t("notIncluded")} />
                        <BoolFeatureRow label={t("advancedReports")} enabled={subscription.hasAdvancedReports} notIncludedText={t("notIncluded")} />
                        <BoolFeatureRow label={t("multiCurrency")} enabled={subscription.hasMultiCurrency} notIncludedText={t("notIncluded")} />
                        <BoolFeatureRow label={t("whiteLabel")} enabled={subscription.hasWhiteLabel} notIncludedText={t("notIncluded")} />
                    </div>
                </CardContent>
            </Card>

            {/* Upgrade Plans (shown when not on Enterprise) */}
            {subscription.plan !== "ENTERPRISE" && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <CardTitle>{t("upgradePlanTitle")}</CardTitle>
                        </div>
                        <CardDescription>
                            {t("upgradePlanDesc")}
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
                                            <p className="font-semibold">{t(`planLabels.${p.plan}`)}</p>
                                            {p.plan === "PROFESSIONAL" && (
                                                <Badge variant="default" className="text-xs">{t("popular")}</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{p.priceKey}</p>
                                    </div>
                                    <ul className="space-y-1">
                                        {p.highlightKeys.map((h) => (
                                            <li key={h} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                                {t(h)}
                                            </li>
                                        ))}
                                    </ul>
                                    <Button
                                        size="sm"
                                        variant={p.plan === "PROFESSIONAL" ? "default" : "outline"}
                                        className="w-full"
                                        onClick={() => handleUpgrade(p.plan)}
                                        disabled={upgradingPlan !== null}
                                    >
                                        {upgradingPlan === p.plan ? t("redirecting") : p.plan === "ENTERPRISE" ? t("contactSales") : t("upgradeButton")}
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <p className="mt-4 text-center text-xs text-muted-foreground">{t("stripeNote")}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
