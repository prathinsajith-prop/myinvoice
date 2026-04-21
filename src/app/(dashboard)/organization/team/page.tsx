"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Loader2, UserPlus, MoreHorizontal, Shield, Users,
  Calculator, Crown, Mail, Clock, Trash2, UserCog,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PermissionGate } from "@/components/tenant/permission-gate";
import { useTenant } from "@/lib/tenant/context";
import { jsonFetcher } from "@/lib/fetcher";
import { useTranslations } from "next-intl";

type MemberRole = "OWNER" | "ADMIN" | "MANAGER" | "ACCOUNTANT" | "MEMBER";

interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  invitedEmail?: string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastLoginAt: string | null;
  };
}

const ROLE_CONFIG: Record<MemberRole, { icon: React.ElementType; color: string }> = {
  OWNER: { icon: Crown, color: "text-amber-600 bg-amber-50 border-amber-200" },
  ADMIN: { icon: Shield, color: "text-blue-600 bg-blue-50 border-blue-200" },
  MANAGER: { icon: UserCog, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  ACCOUNTANT: { icon: Calculator, color: "text-green-600 bg-green-50 border-green-200" },
  MEMBER: { icon: Users, color: "text-purple-600 bg-purple-50 border-purple-200" },
};

function getInitials(name: string | null, email: string) {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return email[0].toUpperCase();
}

export default function TeamSettingsPage() {
  const t = useTranslations("settings.team");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const { role: currentRole, hasPermission } = useTenant();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<MemberRole>("MEMBER");
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canManageMembers = hasPermission("manage_team");
  const canInviteAdmin = currentRole === "OWNER";
  const { data, isLoading: loading, mutate } = useSWR<{ members: Member[] }>(
    "/api/organization/members",
    jsonFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onError() {
        toast.error(t("failedToLoad"));
      },
    }
  );
  const members = data?.members ?? [];

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await fetch("/api/organization/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(t("invitedSuccess"));
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("MEMBER");
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToInvite"));
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingMember) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/organization/members/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(t("roleUpdated"));
      setEditingMember(null);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdate"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/organization/members/${removingMember.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(t("memberRemoved"));
      setRemovingMember(null);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToRemove"));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={`skel-${i}`} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Members Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>{t("title")}</CardTitle>
            </div>
            <PermissionGate permission="manage_team">
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t("invite")}
              </Button>
            </PermissionGate>
          </div>
          <CardDescription>{t("teamMembersDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => {
              const cfg = ROLE_CONFIG[member.role];
              const RoleIcon = cfg.icon;
              const isCurrentUser = member.userId === session?.user?.id;
              const isPending = !member.acceptedAt;

              return (
                <div key={member.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={member.user.image || undefined} alt={member.user.name || member.user.email} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(member.user.name, member.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.user.name || member.user.email.split("@")[0]}</p>
                        {isCurrentUser && <Badge variant="secondary" className="text-xs">{t("you")}</Badge>}
                        {isPending && (
                          <Badge variant="outline" className="text-xs text-orange-600">
                            <Clock className="mr-1 h-3 w-3" />{t("pending")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{member.user.email}</span>
                      </div>
                      {member.user.lastLoginAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("lastActive", { time: formatDistanceToNow(new Date(member.user.lastLoginAt), { addSuffix: true }) })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`flex items-center gap-1 ${cfg.color}`}>
                      <RoleIcon className="h-3 w-3" />
                      {t(`roleLabels.${member.role}`)}
                    </Badge>

                    {canManageMembers && !isCurrentUser && member.role !== "OWNER" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setEditingMember(member); setEditRole(member.role); }}>
                            <UserCog className="mr-2 h-4 w-4" />{t("changeRole")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setRemovingMember(member)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />{t("remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>{t("rolePermissions")}</CardTitle>
          <CardDescription>{t("rolePermissionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.entries(ROLE_CONFIG) as [MemberRole, typeof ROLE_CONFIG.OWNER][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className={`flex items-start gap-3 rounded-lg border p-3 ${cfg.color}`}>
                  <Icon className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium">{t(`roleLabels.${key}`)}</p>
                    <p className="text-sm opacity-80">{t(`roleDescriptions.${key}`)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inviteTeamMember")}</DialogTitle>
            <DialogDescription>{t("inviteDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailAddress")}</Label>
              <Input id="email" type="email" placeholder="colleague@company.ae" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                <SelectTrigger><SelectValue placeholder={t("selectRole")} /></SelectTrigger>
                <SelectContent>
                  {canInviteAdmin && <SelectItem value="ADMIN">{t("roleLabels.ADMIN")}</SelectItem>}
                  <SelectItem value="MANAGER">{t("roleLabels.MANAGER")}</SelectItem>
                  <SelectItem value="ACCOUNTANT">{t("roleLabels.ACCOUNTANT")}</SelectItem>
                  <SelectItem value="MEMBER">{t("roleLabels.MEMBER")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t(`roleDescriptions.${inviteRole}`)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
              {inviting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("inviting")}</> : t("invite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changeMemberRole")}</DialogTitle>
            <DialogDescription>{t("changeMemberRoleDesc", { name: editingMember?.user.name || editingMember?.user.email || "" })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("newRole")}</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as MemberRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {canInviteAdmin && <SelectItem value="ADMIN">{t("roleLabels.ADMIN")}</SelectItem>}
                  <SelectItem value="MANAGER">{t("roleLabels.MANAGER")}</SelectItem>
                  <SelectItem value="ACCOUNTANT">{t("roleLabels.ACCOUNTANT")}</SelectItem>
                  <SelectItem value="MEMBER">{t("roleLabels.MEMBER")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t(`roleDescriptions.${editRole}`)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>{tc("cancel")}</Button>
            <Button onClick={handleUpdateRole} disabled={actionLoading}>
              {actionLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("updating")}</> : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTeamMember")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeConfirm", { name: removingMember?.user.name || removingMember?.user.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={actionLoading}>
              {actionLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("removing")}</> : t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
