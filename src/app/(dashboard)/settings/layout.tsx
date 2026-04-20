"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Users,
  Palette,
  FileText,
  Activity,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

function SettingsSidebar() {
  const pathname = usePathname();
  const t = useTranslations("settings.nav");

  const settingsNavigation = [
    {
      title: t("personal"),
      items: [
        {
          name: t("profileName"),
          href: "/settings/profile",
          icon: User,
        },
        {
          name: t("securityName"),
          href: "/settings/security",
          icon: Shield,
        },
        {
          name: t("notificationsName"),
          href: "/settings/notifications",
          icon: Bell,
        },
      ],
    },
    {
      title: t("organization"),
      items: [
        {
          name: t("generalName"),
          href: "/settings/organization",
          icon: Building2,
        },
        // Team Members hidden for now
        // {
        //   name: t("teamMembersName"),
        //   href: "/settings/team",
        //   icon: Users,
        // },
        {
          name: t("brandingName"),
          href: "/settings/branding",
          icon: Palette,
        },
        {
          name: t("invoiceSettingsName"),
          href: "/settings/invoices",
          icon: FileText,
        },
        {
          name: t("auditLogName"),
          href: "/settings/audit-log",
          icon: Activity,
        },
      ],
    },
    {
      title: t("billing"),
      items: [
        {
          name: t("subscriptionName"),
          href: "/settings/billing",
          icon: CreditCard,
        },
      ],
    },

  ];

  return (
    <aside className="w-64 space-y-6">
      {settingsNavigation.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h3>
          <nav className="space-y-1">
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("manageDescription")}
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-8 lg:flex-row">
        <SettingsSidebar />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
