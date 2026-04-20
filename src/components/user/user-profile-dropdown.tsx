"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  Building2,
  CreditCard,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Shield,
  Check,
  ChevronRight,
  Plus,
  Loader2,
  Blocks,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant/context";
import { useTranslations } from "next-intl";

export function UserProfileDropdown() {
  const router = useRouter();
  const t = useTranslations("userMenu");
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const { organizationId, organizationName, organizationLogo, organizations, switchOrganization } = useTenant();
  const [switching, setSwitching] = useState(false);

  if (status === "loading") {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  if (!session?.user) {
    return (
      <Link href="/login">
        <Button variant="outline" size="sm">Sign In</Button>
      </Link>
    );
  }

  const initials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await signOut({ redirectTo: "/login" });
  };

  async function handleSwitch(orgId: string) {
    if (orgId === organizationId || switching) return;
    setSwitching(true);
    try {
      await switchOrganization(orgId);
      toast.success(t("switchedOrganization"));
      window.location.assign("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch");
      setSwitching(false);
    }
  }

  const orgInitials = organizationName
    ? organizationName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const themes = [
    { value: "light", label: t("light"), icon: Sun },
    { value: "dark", label: t("dark"), icon: Moon },
    { value: "system", label: t("system"), icon: Monitor },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-72" align="end" sideOffset={8} forceMount>
        {/* User Info Header */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-border">
              <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm font-semibold leading-none truncate">
                {session.user.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] capitalize font-medium py-0 px-1.5">
                  <Shield className="mr-1 h-2.5 w-2.5" />
                  {session.user.role?.toLowerCase() ?? "member"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Company Switcher */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 py-2">
            <Avatar className="h-5 w-5 flex-shrink-0">
              <AvatarImage src={organizationLogo ?? undefined} alt={organizationName ?? ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                {orgInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate leading-tight">
                {organizationName ?? t("selectOrganization")}
              </span>
              <span className="text-[10px] text-muted-foreground">{t("switchOrganization")}</span>
            </div>
            {switching && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            {organizations.length === 0 && (
              <DropdownMenuItem disabled className="text-muted-foreground text-sm">
                {t("noOrganizations")}
              </DropdownMenuItem>
            )}
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="gap-2 cursor-pointer"
              >
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={(org as { logo?: string | null }).logo ?? undefined} alt={org.name} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                    {org.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{org.role.toLowerCase()}</p>
                </div>
                {org.id === organizationId && <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/settings/organization/new")}
              className="gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{t("newOrganization")}</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Account Section */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/settings/profile")} className="gap-2 py-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{t("profile")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings/organization")} className="gap-2 py-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{t("organization")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings/billing")} className="gap-2 py-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>{t("billingPlans")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 py-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>{t("settings")}</span>
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Developer Section */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/apps")} className="gap-2 py-2">
            <Blocks className="h-4 w-4 text-muted-foreground" />
            <span>{t("connectedApps")}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Theme Switcher — segmented control */}
        <div className="px-3 py-2.5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("appearance")}</p>
          <div className="flex rounded-md border overflow-hidden">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={[
                  "flex flex-1 flex-col items-center gap-1 py-2 px-1 text-xs font-medium transition-colors",
                  theme === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  value !== "light" ? "border-l" : "",
                ].join(" ")}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Help & Sign Out */}
        <DropdownMenuItem
          onClick={() => window.open("https://help.myinvoice.ae", "_blank")}
          className="gap-2 py-2"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <span>{t("helpSupport")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          <span>{t("signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
