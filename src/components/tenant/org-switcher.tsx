"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useTenant } from "@/lib/tenant/context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function OrgSwitcher() {
  const router = useRouter();
  const {
    organizationId,
    organizationName,
    organizationLogo,
    organizations,
    switchOrganization,
    isLoading,
  } = useTenant();

  const [switching, setSwitching] = useState(false);
  const [fallbackOrganizations, setFallbackOrganizations] = useState<
    Array<{ id: string; name: string; logo?: string | null; role: string }>
  >([]);

  useEffect(() => {
    async function loadOrganizations() {
      if (organizations.length > 0) {
        setFallbackOrganizations([]);
        return;
      }

      try {
        const res = await fetch("/api/organizations", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const mapped = (data.organizations ?? []).map(
          (org: { id: string; name: string; logo?: string | null; role: string }) => ({
            id: org.id,
            name: org.name,
            logo: org.logo ?? null,
            role: org.role,
          })
        );
        setFallbackOrganizations(mapped);
      } catch {
        // Best-effort fallback for stale session payloads.
      }
    }

    loadOrganizations();
  }, [organizations]);

  const visibleOrganizations = useMemo(
    () => (organizations.length > 0 ? organizations : fallbackOrganizations),
    [organizations, fallbackOrganizations]
  );

  async function handleSwitch(orgId: string) {
    if (orgId === organizationId) return;

    setSwitching(true);
    try {
      // Client-side update sends POST to /api/auth/session
      // which sets a new JWT cookie via Set-Cookie header.
      await switchOrganization(orgId);
      toast.success("Switched organization");
      // Hard navigation ensures the browser sends the new cookie
      window.location.assign("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch");
      setSwitching(false);
    }
  }

  const initials = organizationName
    ? organizationName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "??";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-2 h-auto py-2"
          disabled={isLoading || switching}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={organizationLogo ?? undefined} alt={organizationName ?? ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">
              {organizationName ?? "Select org…"}
            </span>
          </div>
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Your Organizations
        </DropdownMenuLabel>

        {visibleOrganizations.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No organizations assigned
          </DropdownMenuItem>
        )}

        {visibleOrganizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarImage src={(org as { logo?: string | null }).logo ?? undefined} alt={org.name} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {org.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm truncate">{org.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {org.role.toLowerCase()}
                </p>
              </div>
            </div>
            {org.id === organizationId && (
              <Check className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push("/settings/organization/new")}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span className="text-sm">Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
