"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { type ColumnDef } from "@tanstack/react-table";
import { Users, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/ui/data-table";
import { USER_ROLE_META } from "@/lib/constants/users";

interface Member {
    id: string;
    role: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
        lastLoginAt: string | null;
    };
}

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
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    useEffect(() => {
        async function fetchMembers() {
            setLoading(true);
            try {
                const res = await fetch("/api/organization/members", { cache: "no-store" });
                if (!res.ok) throw new Error("Failed to load team members");
                const data = await res.json();
                setMembers(data.members ?? []);
            } finally {
                setLoading(false);
            }
        }

        fetchMembers();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return members;
        return members.filter((m) => {
            const name = (m.user.name ?? "").toLowerCase();
            const email = (m.user.email ?? "").toLowerCase();
            const role = m.role.toLowerCase();
            return name.includes(q) || email.includes(q) || role.includes(q);
        });
    }, [members, search]);

    const counts = useMemo(() => {
        return members.reduce(
            (acc, m) => {
                acc.total += 1;
                if (m.role === "OWNER") acc.owners += 1;
                if (m.role === "ADMIN") acc.admins += 1;
                if (["MEMBER", "ACCOUNTANT", "VIEWER"].includes(m.role)) acc.staff += 1;
                return acc;
            },
            { total: 0, owners: 0, admins: 0, staff: 0 }
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

    const columns = useMemo<ColumnDef<Member>[]>(() => [
        {
            id: "user",
            header: "User",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Avatar size="default" className="border">
                        <AvatarImage src={row.original.user.image ?? undefined} alt={row.original.user.name ?? row.original.user.email} />
                        <AvatarFallback>{initials(row.original.user.name, row.original.user.email)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{row.original.user.name ?? "Unnamed User"}</span>
                </div>
            ),
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
                <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMember(row.original)}>
                        View
                    </Button>
                </div>
            ),
        },
    ], []);

    return (
        <div className="space-y-6 xl:space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                    <p className="text-sm text-muted-foreground">People assigned to your current organization</p>
                </div>
                <Button asChild>
                    <Link href="/settings/team">Manage Team</Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            </div>

            <Card>
                <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-base">User Listing</CardTitle>
                        <Input
                            className="w-full sm:w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, email, or role"
                        />
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
                                                    <p className="truncate font-medium">{member.user.name ?? "Unnamed User"}</p>
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
                                                        <Button variant="outline" size="sm" onClick={() => setSelectedMember(member)}>
                                                            View
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
        </div>
    );
}
