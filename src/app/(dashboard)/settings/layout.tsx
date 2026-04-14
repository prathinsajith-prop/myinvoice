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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const settingsNavigation = [
  {
    title: "Personal",
    items: [
      {
        name: "Profile",
        href: "/settings/profile",
        icon: User,
        description: "Manage your personal information",
      },
      {
        name: "Security",
        href: "/settings/security",
        icon: Shield,
        description: "Password and two-factor authentication",
      },
      {
        name: "Notifications",
        href: "/settings/notifications",
        icon: Bell,
        description: "Choose what notifications you receive",
      },
    ],
  },
  {
    title: "Organization",
    items: [
      {
        name: "General",
        href: "/settings/organization",
        icon: Building2,
        description: "Organization details and settings",
      },
      {
        name: "Team Members",
        href: "/settings/team",
        icon: Users,
        description: "Manage your team and permissions",
      },
      {
        name: "Branding",
        href: "/settings/branding",
        icon: Palette,
        description: "Customize your invoice appearance",
      },
      {
        name: "Invoice Settings",
        href: "/settings/invoices",
        icon: FileText,
        description: "Default invoice settings and templates",
      },
    ],
  },
  {
    title: "Billing",
    items: [
      {
        name: "Subscription",
        href: "/settings/billing",
        icon: CreditCard,
        description: "Manage your subscription and billing",
      },
    ],
  },
];

function SettingsSidebar() {
  const pathname = usePathname();

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and organization settings
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
