"use client";

import { useState } from "react";
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

  async function handleSwitch(orgId: string) {
    if (orgId === organizationId) return;

    setSwitching(true);
    try {
      // Validate on server side first
      const res = await fetch("/api/organization/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to switch organization");
      }

      // Update the JWT/session
      await switchOrganization(orgId);
      toast.success("Switched organization");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch");
    } finally {
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

        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-6 w-6 flex-shrink-0">
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
          onClick={() => router.push("/dashboard/settings/organization/new")}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span className="text-sm">Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
