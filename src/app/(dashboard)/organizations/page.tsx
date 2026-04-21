"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useTenant } from "@/lib/tenant/context";
import { Building2, Loader2, CheckCircle2, ArrowRightLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { jsonFetcher } from "@/lib/fetcher";

interface OrganizationItem {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    isActive: boolean;
    role: string;
    isCurrent: boolean;
    createdAt: string;
    joinedAt: string;
}

interface OrganizationDetail {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    trn: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    emirate: string | null;
    country: string | null;
    postalCode: string | null;
    logo: string | null;
    isActive: boolean;
    createdAt: string;
    role: string;
    subscription: {
        plan: string;
        status: string;
        trialEndsAt: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean | null;
        monthlyInvoiceLimit: number | null;
        teamMemberLimit: number | null;
        customersLimit: number | null;
    } | null;
}

export default function OrganizationsPage() {
    const { organizationId, switchOrganization } = useTenant();
    const t = useTranslations("organizationsPage");
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [selectedOrganization, setSelectedOrganization] = useState<OrganizationDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const { data, isLoading: loading } = useSWR<{ organizations?: OrganizationItem[] }>(
        "/api/organizations",
        jsonFetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            onError(error) {
                toast.error(error instanceof Error ? error.message : t("failedToLoad"));
            },
        }
    );

    const organizations = useMemo(() => data?.organizations ?? [], [data]);

    const stats = useMemo(() => {
        return organizations.reduce(
            (acc, org) => {
                acc.total += 1;
                if (org.isActive) acc.active += 1;
                if (org.id === organizationId) acc.current = org.name;
                return acc;
            },
            { total: 0, active: 0, current: "" }
        );
    }, [organizations, organizationId]);

    async function handleSwitch(targetOrgId: string) {
        if (targetOrgId === organizationId) return;

        setSwitchingId(targetOrgId);
        try {
            const validateRes = await fetch("/api/organization/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organizationId: targetOrgId }),
            });

            const payload = await validateRes.json();
            if (!validateRes.ok) {
                throw new Error(payload.error ?? "Unable to switch organization");
            }

            await switchOrganization(targetOrgId);
            toast.success(t("switchedTo", { name: payload.organizationName }));
            // Hard navigation to pick up the new session cookie
            window.location.href = "/dashboard";
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("switchFailed"));
            setSwitchingId(null);
        }
    }

    async function handleOpenDetails(orgId: string) {
        setSelectedOrganization(null);
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/organizations/${orgId}`, { cache: "no-store" });
            if (!res.ok) {
                const payload = await res.json();
                throw new Error(payload.error ?? "Failed to load organization details");
            }

            const data = (await res.json()) as OrganizationDetail;
            setSelectedOrganization(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("failedToLoadDetails"));
        } finally {
            setDetailLoading(false);
        }
    }

    return (
        <div className="space-y-6 xl:space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-sm text-muted-foreground">{t("description")}</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="outline" asChild>
                        <Link href="/organization">{t("manageCurrent")}</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/organization/new">
                            <Plus className="mr-2 h-4 w-4" />
                            {t("createOrganization")}
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardDescription>{t("total")}</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>{t("active")}</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.active}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>{t("current")}</CardDescription></CardHeader>
                    <CardContent><div className="truncate text-sm font-medium">{stats.current || t("notSelected")}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t("orgListing")}</CardTitle>
                    <CardDescription>{t("orgListingDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
                                    <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-28" />
                                    </div>
                                    <Skeleton className="h-8 w-16 rounded-md" />
                                    <Skeleton className="h-8 w-20 rounded-md" />
                                </div>
                            ))}
                        </div>
                    ) : organizations.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title={t("noOrgsYet")}
                            description={t("noOrgsYetDesc")}
                        />
                    ) : (
                        <div className="space-y-3">
                            {organizations.map((org) => (
                                <div key={org.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="mt-0.5 h-9 w-9 rounded-lg border">
                                            <AvatarImage src={org.logo ?? undefined} alt={org.name} />
                                            <AvatarFallback className="rounded-lg bg-muted">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate font-semibold">{org.name}</p>
                                                {org.isCurrent && (
                                                    <Badge variant="default" className="gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {t("currentBadge")}
                                                    </Badge>
                                                )}
                                                {!org.isActive && <Badge variant="destructive">{t("inactive")}</Badge>}
                                            </div>
                                            <p className="text-sm text-muted-foreground">/{org.slug} • {org.role.toLowerCase()}</p>
                                            <p className="text-xs text-muted-foreground">Joined {new Date(org.joinedAt).toLocaleDateString("en-AE")}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleOpenDetails(org.id)}>
                                            {t("view")}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={org.id === organizationId ? "outline" : "default"}
                                            onClick={() => handleSwitch(org.id)}
                                            disabled={org.id === organizationId || !!switchingId}
                                        >
                                            {switchingId === org.id ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("switching")}</>
                                            ) : org.id === organizationId ? (
                                                t("currentBadge")
                                            ) : (
                                                <><ArrowRightLeft className="mr-2 h-4 w-4" />{t("switch")}</>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Sheet
                open={!!selectedOrganization || detailLoading}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedOrganization(null);
                        setDetailLoading(false);
                    }
                }}
            >
                <SheetContent className="w-full sm:max-w-xl">
                    <SheetHeader className="border-b px-6 pb-4 pt-6">
                        <div className="flex items-center gap-4 pr-8">
                            <Avatar className="h-14 w-14 rounded-xl border">
                                <AvatarImage src={selectedOrganization?.logo ?? undefined} alt={selectedOrganization?.name ?? "Organization"} />
                                <AvatarFallback className="rounded-xl bg-muted">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <SheetTitle>{selectedOrganization?.name ?? t("loadingOrg")}</SheetTitle>
                                <SheetDescription>
                                    {selectedOrganization ? `/${selectedOrganization.slug}` : t("fetchingDetails")}
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>

                    {detailLoading && !selectedOrganization ? (
                        <div className="space-y-4 px-6 py-6">
                            <div className="grid gap-3 sm:grid-cols-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-4 w-28" />
                                    </div>
                                ))}
                            </div>
                            <Skeleton className="h-px w-full" />
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-4 w-36" />
                                </div>
                            ))}
                        </div>
                    ) : selectedOrganization ? (
                        <>
                            <div className="space-y-6 px-6 py-6">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={selectedOrganization.isActive ? "default" : "destructive"}>
                                        {selectedOrganization.isActive ? t("active") : t("inactive")}
                                    </Badge>
                                    <Badge variant="secondary">{selectedOrganization.role}</Badge>
                                    {selectedOrganization.id === organizationId && <Badge variant="outline">{t("currentBadge")}</Badge>}
                                </div>

                                <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("plan")}</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.plan ?? t("noPlan")}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("status")}</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.status ?? t("unknown")}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("teamLimit")}</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.teamMemberLimit ?? "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("customerLimit")}</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.customersLimit ?? "-"}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("contact")}</p>
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p>{selectedOrganization.email || t("noEmail")}</p>
                                            <p>{selectedOrganization.phone || t("noPhone")}</p>
                                            <p>{selectedOrganization.website || t("noWebsite")}</p>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("address")}</p>
                                        <p className="mt-2 text-sm">
                                            {[
                                                selectedOrganization.addressLine1,
                                                selectedOrganization.addressLine2,
                                                selectedOrganization.city,
                                                selectedOrganization.emirate,
                                                selectedOrganization.country,
                                                selectedOrganization.postalCode,
                                            ]
                                                .filter(Boolean)
                                                .join(", ") || t("noAddress")}
                                        </p>
                                    </div>

                                    <Separator />

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">TRN</p>
                                            <p className="mt-1 text-sm font-medium">{selectedOrganization.trn || "Not provided"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                                            <p className="mt-1 text-sm font-medium">
                                                {new Date(selectedOrganization.createdAt).toLocaleDateString("en-AE")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-between">
                                <Button
                                    variant="outline"
                                    onClick={() => handleSwitch(selectedOrganization.id)}
                                    disabled={selectedOrganization.id === organizationId || !!switchingId}
                                >
                                    {selectedOrganization.id === organizationId ? t("currentOrganization") : t("switchHere")}
                                </Button>
                                {selectedOrganization.id === organizationId && ["OWNER", "ADMIN"].includes(selectedOrganization.role) ? (
                                    <Button asChild>
                                        <Link href="/organization">{t("editOrganization")}</Link>
                                    </Button>
                                ) : (
                                    <Button onClick={() => setSelectedOrganization(null)}>{t("close")}</Button>
                                )}
                            </SheetFooter>
                        </>
                    ) : null}
                </SheetContent>
            </Sheet>
        </div>
    );
}
