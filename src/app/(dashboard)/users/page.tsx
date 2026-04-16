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

type InviteRole = "ADMIN" | "ACCOUNTANT" | "MEMBER" | "VIEWER";

const ROLE_DESCRIPTIONS: Record<InviteRole, string> = {
    ADMIN: "Full access except organization deletion",
    ACCOUNTANT: "Financial access, manage invoices",
    MEMBER: "View and limited edit access",
    VIEWER: "Read-only access",
};

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
                if (["MEMBER", "ACCOUNTANT", "VIEWER"].includes(m.role)) acc.staff += 1;
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
            toast.success("User invited successfully and added to the listing");
            setInviteOpen(false);
            setInviteEmail("");
            setInviteRole("MEMBER");
            await mutate();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to invite user");
        } finally {
            setInviting(false);
        }
    };

    const columns = useMemo<ColumnDef<Member>[]>(() => [
        {
            id: "user",
            header: "User",
            cell: ({ row }) => {
                const isPending = row.original.inviteStatus === "PENDING" || !row.original.acceptedAt;
                return (
                    <div className="flex items-center gap-2">
                        <Avatar size="default" className="border">
                            <AvatarImage src={row.original.user.image ?? undefined} alt={row.original.user.name ?? row.original.user.email} />
                            <AvatarFallback>{initials(row.original.user.name, row.original.user.email)}</AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{row.original.user.name ?? "Unnamed User"}</span>
                            {isPending && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">
                                    <Clock className="mr-1 h-3 w-3" />Pending
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            id: "email",
            header: "Email",
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.user.email}</span>,
        },
        {
            id: "role",
            header: "Role",
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
            header: "Last Login",
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {row.original.user.lastLoginAt
                        ? new Date(row.original.user.lastLoginAt).toLocaleString("en-AE")
                        : "Never"}
                </span>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => (
                <div role="presentation" className="text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setSelectedMember(row.original)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], []);

    return (
        <div className="space-y-6 xl:space-y-8">
            <PageHeader
                title="Users"
                description="People assigned to your current organization"
                onRefresh={() => {
                    void mutate();
                }}
                isRefreshing={loading}
                actions={
                    <>
                        <PermissionGate permission="manage_team">
                            <Button onClick={() => setInviteOpen(true)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Invite User
                            </Button>
                        </PermissionGate>
                        <Button variant="outline" asChild>
                            <Link href="/settings/team">Manage Team</Link>
                        </Button>
                    </>
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2"><CardDescription>Total Users</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{counts.total}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>Owners & Admins</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{counts.owners + counts.admins}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>Team Members</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{counts.staff}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardDescription>Pending Invites</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-orange-600">{counts.pending}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-base">User Listing</CardTitle>
                        <div className="flex items-center gap-3 flex-wrap">
                            <SearchInput
                                placeholder="Search by name, email, or role"
                                value={search}
                                onChange={setSearch}
                                className="relative w-full sm:w-64"
                            />
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Roles</SelectItem>
                                    <SelectItem value="OWNER">Owner</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                                    <SelectItem value="MEMBER">Member</SelectItem>
                                    <SelectItem value="VIEWER">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-14 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
                            No users found for this filter.
                        </div>
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
                                                        <p className="truncate font-medium">{member.user.name ?? "Unnamed User"}</p>
                                                        {isPending && (
                                                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">
                                                                <Clock className="mr-1 h-3 w-3" />Pending
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
                                                                ? new Date(member.user.lastLoginAt).toLocaleDateString("en-AE")
                                                                : "Never"}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex gap-2">
                                                        <Button variant="outline" size="icon" className="h-8 w-8" title="View" onClick={() => setSelectedMember(member)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" asChild>
                                                            <Link href={isCurrentUser ? "/settings/profile" : "/settings/team"}>
                                                                {isCurrentUser ? "Edit Profile" : "Manage Access"}
                                                            </Link>
                                                        </Button>
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
                                        <SheetTitle>{selectedMember.user.name ?? "Unnamed User"}</SheetTitle>
                                        <SheetDescription>{selectedMember.user.email}</SheetDescription>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="space-y-6 px-6 py-6">
                                <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                                        <Badge variant={selectedRoleMeta?.variant ?? "outline"} className="mt-2 gap-1">
                                            <SelectedRoleIcon className="h-3 w-3" />
                                            {selectedRoleMeta?.label ?? selectedMember.role}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Login</p>
                                        <p className="mt-2 text-sm font-medium">
                                            {selectedMember.user.lastLoginAt
                                                ? new Date(selectedMember.user.lastLoginAt).toLocaleString("en-AE")
                                                : "Never"}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
                                        <p className="mt-1 text-sm font-medium">{selectedMember.user.name ?? "Unnamed User"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                                        <p className="mt-1 text-sm font-medium">{selectedMember.user.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Access</p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {selectedRoleMeta?.label ?? selectedMember.role} access is configured for this organization.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-between">
                                {(() => {
                                    const isCurrentUser = selectedMember.user.id === session?.user?.id;
                                    return (
                                        <Button variant="outline" asChild>
                                            <Link href={isCurrentUser ? "/settings/profile" : "/settings/team"}>
                                                {isCurrentUser ? "Edit Profile" : "Manage Team"}
                                            </Link>
                                        </Button>
                                    );
                                })()}
                                <Button onClick={() => setSelectedMember(null)}>Close</Button>
                            </SheetFooter>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* Invite User Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite User</DialogTitle>
                        <DialogDescription>
                            Invite a user to your organization. If they don&apos;t have an account, one will be created automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="invite-email">Email Address</Label>
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
                            <Label>Role</Label>
                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as InviteRole)}>
                                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                                <SelectContent>
                                    {canInviteAdmin && <SelectItem value="ADMIN">Admin</SelectItem>}
                                    <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                                    <SelectItem value="MEMBER">Member</SelectItem>
                                    <SelectItem value="VIEWER">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[inviteRole]}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                            {inviting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Inviting…</> : "Send Invitation"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
