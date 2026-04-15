"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useTenant } from "@/lib/tenant/context";
import { Building2, Loader2, CheckCircle2, ArrowRightLeft, Plus } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
    const router = useRouter();
    const { organizationId, switchOrganization } = useTenant();
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
                toast.error(error instanceof Error ? error.message : "Failed to load organizations");
            },
        }
    );

    const organizations = data?.organizations ?? [];

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
            toast.success(`Switched to ${payload.organizationName}`);
            // Hard navigation to pick up the new session cookie
            window.location.href = "/dashboard";
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Organization switch failed");
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
            toast.error(error instanceof Error ? error.message : "Failed to load organization details");
        } finally {
            setDetailLoading(false);
        }
    }

    return (
        <div className="space-y-6 xl:space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
                    <p className="text-sm text-muted-foreground">All organizations assigned to your account</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="outline" asChild>
                        <Link href="/settings/organization">Manage Current</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/settings/organization/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Organization
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardDescription>Total</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>Active</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.active}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>Current</CardDescription></CardHeader>
                    <CardContent><div className="truncate text-sm font-medium">{stats.current || "Not selected"}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Organization Listing</CardTitle>
                    <CardDescription>Switch between assigned organizations instantly</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-14 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : organizations.length === 0 ? (
                        <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
                            No organizations assigned yet.
                        </div>
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
                                                        Current
                                                    </Badge>
                                                )}
                                                {!org.isActive && <Badge variant="destructive">Inactive</Badge>}
                                            </div>
                                            <p className="text-sm text-muted-foreground">/{org.slug} • {org.role.toLowerCase()}</p>
                                            <p className="text-xs text-muted-foreground">Joined {new Date(org.joinedAt).toLocaleDateString("en-AE")}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleOpenDetails(org.id)}>
                                            View
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={org.id === organizationId ? "outline" : "default"}
                                            onClick={() => handleSwitch(org.id)}
                                            disabled={org.id === organizationId || !!switchingId}
                                        >
                                            {switchingId === org.id ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Switching...</>
                                            ) : org.id === organizationId ? (
                                                "Current"
                                            ) : (
                                                <><ArrowRightLeft className="mr-2 h-4 w-4" />Switch</>
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
                                <SheetTitle>{selectedOrganization?.name ?? "Loading organization"}</SheetTitle>
                                <SheetDescription>
                                    {selectedOrganization ? `/${selectedOrganization.slug}` : "Fetching organization details"}
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>

                    {detailLoading && !selectedOrganization ? (
                        <div className="flex min-h-[18rem] items-center justify-center px-6 py-6 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : selectedOrganization ? (
                        <>
                            <div className="space-y-6 px-6 py-6">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={selectedOrganization.isActive ? "default" : "destructive"}>
                                        {selectedOrganization.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                    <Badge variant="secondary">{selectedOrganization.role}</Badge>
                                    {selectedOrganization.id === organizationId && <Badge variant="outline">Current</Badge>}
                                </div>

                                <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.plan ?? "No plan"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.status ?? "Unknown"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Team Limit</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.teamMemberLimit ?? "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer Limit</p>
                                        <p className="mt-1 text-sm font-medium">{selectedOrganization.subscription?.customersLimit ?? "-"}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p>{selectedOrganization.email || "No email"}</p>
                                            <p>{selectedOrganization.phone || "No phone"}</p>
                                            <p>{selectedOrganization.website || "No website"}</p>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Address</p>
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
                                                .join(", ") || "No address saved"}
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
                                    {selectedOrganization.id === organizationId ? "Current Organization" : "Switch Here"}
                                </Button>
                                {selectedOrganization.id === organizationId && ["OWNER", "ADMIN"].includes(selectedOrganization.role) ? (
                                    <Button asChild>
                                        <Link href="/settings/organization">Edit Organization</Link>
                                    </Button>
                                ) : (
                                    <Button onClick={() => setSelectedOrganization(null)}>Close</Button>
                                )}
                            </SheetFooter>
                        </>
                    ) : null}
                </SheetContent>
            </Sheet>
        </div>
    );
}
