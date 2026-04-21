"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Building2,
    Palette,
    FileText,
    Activity,
    Users,
    Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

function OrganizationSidebar() {
    const pathname = usePathname();
    const t = useTranslations("organization.nav");

    const organizationNavigation = [
        {
            title: t("general"),
            items: [
                {
                    name: t("generalName"),
                    href: "/organization",
                    icon: Building2,
                },
                {
                    name: t("brandingName"),
                    href: "/organization/branding",
                    icon: Palette,
                },
                {
                    name: t("pdfTemplatesName"),
                    href: "/organization/pdf-templates",
                    icon: FileText,
                },
            ],
        },
        {
            title: t("configuration"),
            items: [
                {
                    name: t("invoiceSettingsName"),
                    href: "/organization/invoices",
                    icon: Settings,
                },
                {
                    name: t("teamMembersName"),
                    href: "/organization/team",
                    icon: Users,
                },
                {
                    name: t("auditLogName"),
                    href: "/organization/audit-log",
                    icon: Activity,
                },
            ],
        },
    ];

    return (
        <aside className="w-64 space-y-6">
            {organizationNavigation.map((section, idx) => (
                <div key={section.title}>
                    {idx > 0 && <Separator className="mb-4" />}
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

export default function OrganizationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const t = useTranslations("organization");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground">
                    {t("description")}
                </p>
            </div>

            <Separator />

            <div className="flex flex-col gap-8 lg:flex-row">
                <OrganizationSidebar />
                <div className="flex-1">{children}</div>
            </div>
        </div>
    );
}
