"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { type ColumnDef } from "@tanstack/react-table";
import { Users, Loader2, UserPlus, Clock, Eye } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { PermissionGate } from "@/components/tenant/permission-gate";
import { useTenant } from "@/lib/tenant/context";
import { USER_ROLE_META } from "@/lib/constants/users";
import { jsonFetcher } from "@/lib/fetcher";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { useTranslations } from "next-intl";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { formatDate } from "@/lib/format";

interface Member {
    id: string;
    role: string;
    inviteStatus?: string;
    acceptedAt?: string | null;
    user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
        lastLoginAt: string | null;
    };
}

type InviteRole = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "MEMBER";

function initials(name: string | null, email: string): string {
    if (!name) return email.slice(0, 2).toUpperCase();
    return name
        .split(" ")
        .filter(Boolean)
        .map((v) => v[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export default function UsersPage() {
    const t = useTranslations("users");
    const tc = useTranslations("common");
    const orgSettings = useOrgSettings();
    const dateFormat = orgSettings.dateFormat;
    const { data: session } = useSession();
    const { role: currentRole } = useTenant();
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<InviteRole>("MEMBER");
    const [inviting, setInviting] = useState(false);
    const canInviteAdmin = currentRole === "OWNER";

    const { data, isLoading: loading, mutate } = useSWR<{ members?: Member[] }>(
        "/api/organization/members",
        jsonFetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const members = useMemo(() => data?.members ?? [], [data]);

    const filtered = useMemo(() => {
        let result = members;
        if (roleFilter !== "ALL") {
            result = result.filter((m) => m.role === roleFilter);
        }
        const q = search.trim().toLowerCase();
        if (q) {
            result = result.filter((m) => {
                const name = (m.user.name ?? "").toLowerCase();
                const email = (m.user.email ?? "").toLowerCase();
                const role = m.role.toLowerCase();
                return name.includes(q) || email.includes(q) || role.includes(q);
            });
        }
        return result;
    }, [members, search, roleFilter]);

    const counts = useMemo(() => {
        return members.reduce(
            (acc, m) => {
                acc.total += 1;
                if (m.role === "OWNER") acc.owners += 1;
                if (m.role === "ADMIN") acc.admins += 1;
                if (["MEMBER", "ACCOUNTANT", "MANAGER"].includes(m.role)) acc.staff += 1;
                if (m.inviteStatus === "PENDING" || !m.acceptedAt) acc.pending += 1;
                return acc;
            },
            { total: 0, owners: 0, admins: 0, staff: 0, pending: 0 }
        );
    }, [members]);

    const selectedRoleMeta = selectedMember
        ? USER_ROLE_META[selectedMember.role] ?? {
            label: selectedMember.role,
            variant: "outline" as const,
            icon: Users,
        }
        : null;
    const SelectedRoleIcon = selectedRoleMeta?.icon ?? Users;

    const handleInvite = async () => {
        const email = inviteEmail.trim();
        if (!email) return;
        setInviting(true);
        try {
            const res = await fetch("/api/organization/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, role: inviteRole }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed to invite user");
            }
            toast.success(t("inviteSuccess"));
            setInviteOpen(false);
            setInviteEmail("");
            setInviteRole("MEMBER");
            await mutate();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : t("inviteFailed"));
        } finally {
            setInviting(false);
        }
    };

    const columns = useMemo<ColumnDef<Member>[]>(() => [
        {
            id: "user",
            header: t("user"),
            cell: ({ row }) => {
                const isPending = row.original.inviteStatus === "PENDING" || !row.original.acceptedAt;
                return (
                    <div className="flex items-center gap-2">
                        <Avatar size="default" className="border">
                            <AvatarImage src={row.original.user.image ?? undefined} alt={row.original.user.name ?? row.original.user.email} />
                            <AvatarFallback>{initials(row.original.user.name, row.original.user.email)}</AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{row.original.user.name ?? t("unnamedUser")}</span>
                            {isPending && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">
                                    <Clock className="mr-1 h-3 w-3" />{t("pending")}
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            id: "email",
            header: t("email"),
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.user.email}</span>,
        },
        {
            id: "role",
            header: t("role"),
            cell: ({ row }) => {
                const meta = USER_ROLE_META[row.original.role] ?? {
                    label: row.original.role,
                    variant: "outline" as const,
                    icon: Users,
                };
                const Icon = meta.icon;

                return (
                    <Badge variant={meta.variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {meta.label}
                    </Badge>
                );
            },
        },
        {
            id: "lastLogin",
            header: t("lastLogin"),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {row.original.user.lastLoginAt
                        ? new Date(row.original.user.lastLoginAt).toLocaleString("en-AE")
                        : t("never")}
                </span>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">{tc("actions")}</div>,
            cell: ({ row }) => (
                <div role="presentation" className="text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("view")} onClick={() => setSelectedMember(row.original)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], [t, tc]);

    return (
        <div className="space-y-6 xl:space-y-8">
            <PageHeader
                title={t("title")}
                description={t("description")}
                onRefresh={() => {
                    void mutate();
                }}
                isRefreshing={loading}
                actions={
                    <PermissionGate permission="manage_team">
                        <Button onClick={() => setInviteOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            {t("inviteUser")}
                        </Button>
                    </PermissionGate>
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2"><CardDescription>{t("totalUsers")}</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{counts.total}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>{t("ownersAdmins")}</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{counts.owners + counts.admins}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>{t("teamMembers")}</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{counts.staff}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>{t("pendingInvites")}</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-orange-600">{counts.pending}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-base">{t("userListing")}</CardTitle>
                        <div className="flex items-center gap-3 flex-wrap">
                            <SearchInput
                                placeholder={t("searchPlaceholder")}
                                value={search}
                                onChange={setSearch}
                                className="relative w-full sm:w-64"
                            />
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">{t("allRoles")}</SelectItem>
                                    <SelectItem value="OWNER">{t("roleLabels.owner")}</SelectItem>
                                    <SelectItem value="ADMIN">{t("roleLabels.admin")}</SelectItem>
                                    <SelectItem value="MANAGER">{t("roleLabels.manager")}</SelectItem>
                                    <SelectItem value="ACCOUNTANT">{t("roleLabels.accountant")}</SelectItem>
                                    <SelectItem value="MEMBER">{t("roleLabels.member")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3 py-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 rounded-lg border px-4 py-3">
                                    <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-36" />
                                        <Skeleton className="h-3 w-48" />
                                    </div>
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title={t("noUsersFound")}
                            description={t("noUsersFoundDesc")}
                        />
                    ) : (
                        <>
                            <div className="space-y-3 md:hidden">
                                {filtered.map((member) => {
                                    const isCurrentUser = member.user.id === session?.user?.id;
                                    const isPending = member.inviteStatus === "PENDING" || !member.acceptedAt;
                                    const meta = USER_ROLE_META[member.role] ?? {
                                        label: member.role,
                                        variant: "outline" as const,
                                        icon: Users,
                                    };
                                    const Icon = meta.icon;

                                    return (
                                        <div key={member.id} className="rounded-lg border p-3">
                                            <div className="flex items-start gap-3">
                                                <Avatar size="default" className="border">
                                                    <AvatarImage src={member.user.image ?? undefined} alt={member.user.name ?? member.user.email} />
                                                    <AvatarFallback>{initials(member.user.name, member.user.email)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate font-medium">{member.user.name ?? t("unnamedUser")}</p>
                                                        {isPending && (
                                                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">
                                                                <Clock className="mr-1 h-3 w-3" />{t("pending")}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                                                    <div className="mt-2 flex items-center justify-between gap-2">
                                                        <Badge variant={meta.variant} className="gap-1">
                                                            <Icon className="h-3 w-3" />
                                                            {meta.label}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {member.user.lastLoginAt
                                                                ? formatDate(member.user.lastLoginAt, dateFormat)
                                                                : t("never")}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex gap-2">
                                                        <Button variant="outline" size="icon" className="h-8 w-8" title={tc("view")} onClick={() => setSelectedMember(member)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {isCurrentUser && (
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href="/settings/profile">{t("editProfile")}</Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                                <DataTable columns={columns} data={filtered} onRowClick={setSelectedMember} />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
                <SheetContent className="w-full sm:max-w-lg">
                    {selectedMember && (
                        <>
                            <SheetHeader className="border-b px-6 pb-4 pt-6">
                                <div className="flex items-center gap-4 pr-8">
                                    <Avatar className="h-14 w-14 border">
                                        <AvatarImage src={selectedMember.user.image ?? undefined} alt={selectedMember.user.name ?? selectedMember.user.email} />
                                        <AvatarFallback>{initials(selectedMember.user.name, selectedMember.user.email)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <SheetTitle>{selectedMember.user.name ?? t("unnamedUser")}</SheetTitle>
                                        <SheetDescription>{selectedMember.user.email}</SheetDescription>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="space-y-6 px-6 py-6">
                                <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("role")}</p>
                                        <Badge variant={selectedRoleMeta?.variant ?? "outline"} className="mt-2 gap-1">
                                            <SelectedRoleIcon className="h-3 w-3" />
                                            {selectedRoleMeta?.label ?? selectedMember.role}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("lastLogin")}</p>
                                        <p className="mt-2 text-sm font-medium">
                                            {selectedMember.user.lastLoginAt
                                                ? new Date(selectedMember.user.lastLoginAt).toLocaleString("en-AE")
                                                : t("never")}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("name")}</p>
                                        <p className="mt-1 text-sm font-medium">{selectedMember.user.name ?? t("unnamedUser")}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("email")}</p>
                                        <p className="mt-1 text-sm font-medium">{selectedMember.user.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("access")}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {t("accessDescription", { role: selectedRoleMeta?.label ?? selectedMember.role })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-between">
                                {(() => {
                                    const isCurrentUser = selectedMember.user.id === session?.user?.id;
                                    return isCurrentUser ? (
                                        <Button variant="outline" asChild>
                                            <Link href="/settings/profile">{t("editProfile")}</Link>
                                        </Button>
                                    ) : null;
                                })()}
                                <Button onClick={() => setSelectedMember(null)}>{tc("close")}</Button>
                            </SheetFooter>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* Invite User Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("inviteUser")}</DialogTitle>
                        <DialogDescription>
                            {t("inviteDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="invite-email">{t("emailAddress")}</Label>
                            <Input
                                id="invite-email"
                                type="email"
                                placeholder="user@company.ae"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("role")}</Label>
                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as InviteRole)}>
                                <SelectTrigger><SelectValue placeholder={t("selectRole")} /></SelectTrigger>
                                <SelectContent>
                                    {canInviteAdmin && <SelectItem value="ADMIN">{t("roleLabels.admin")}</SelectItem>}
                                    <SelectItem value="MANAGER">{t("roleLabels.manager")}</SelectItem>
                                    <SelectItem value="ACCOUNTANT">{t("roleLabels.accountant")}</SelectItem>
                                    <SelectItem value="MEMBER">{t("roleLabels.member")}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{t(`roles.${inviteRole}`)}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>{tc("cancel")}</Button>
                        <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                            {inviting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("inviting")}</> : t("sendInvitation")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
