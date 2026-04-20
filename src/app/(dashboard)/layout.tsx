"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FileText,
  FileCheck,
  FileMinus,
  FilePlus,
  Users,
  Building2,
  Package,
  Receipt,
  CreditCard,
  BarChart3,
  Menu,
  Truck,
  LogOut,
  RefreshCcw,
  Bell,
  ShoppingCart,
  Calculator,
  UserCog,
  GitMerge,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useUIStore } from "@/lib/stores/ui-store";
import { GlobalSearch } from "@/components/global-search";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { UserProfileDropdown } from "@/components/user/user-profile-dropdown";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ErrorBoundary } from "@/components/error-boundary";

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const navigation = [
    {
      items: [
        { name: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: t("sections.sales"),
      items: [
        { name: t("invoices"), href: "/invoices", icon: FileText },
        { name: t("quotations"), href: "/quotations", icon: FileCheck },
        { name: t("creditNotes"), href: "/credit-notes", icon: FileMinus },
        { name: t("deliveryNotes"), href: "/delivery-notes", icon: Truck },
        { name: t("recurringInvoices"), href: "/recurring-invoices", icon: RefreshCcw },
        { name: t("customers"), href: "/customers", icon: Users },
      ],
    },
    {
      label: t("sections.purchases"),
      items: [
        { name: t("bills"), href: "/bills", icon: Receipt },
        { name: t("purchaseOrders"), href: "/purchase-orders", icon: ShoppingCart },
        { name: t("debitNotes"), href: "/debit-notes", icon: FilePlus },
        { name: t("suppliers"), href: "/suppliers", icon: Building2 },
        { name: t("expenses"), href: "/expenses", icon: CreditCard },
      ],
    },
    {
      label: t("sections.catalog"),
      items: [
        { name: t("products"), href: "/products", icon: Package },
      ],
    },
    {
      label: t("sections.finance"),
      items: [
        { name: t("reports"), href: "/reports", icon: BarChart3 },
        { name: t("vatReturns"), href: "/vat-returns", icon: Calculator },
        { name: t("paymentReminders"), href: "/payment-reminders", icon: Bell },
        { name: t("reconciliation"), href: "/reconciliation", icon: GitMerge },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    );

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">myinvoice.ae</span>
        </Link>
      </div>

      <Separator />

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navigation.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onLinkClick}
                  className={navLinkClass(isActive(item.href))}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <Separator />

      {/* Administration */}
      <nav className="px-3 pt-2 pb-1">
        <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("sections.administration")}
        </p>
        <div className="space-y-0.5">
          <Link
            href="/users"
            onClick={onLinkClick}
            className={navLinkClass(isActive("/users"))}
          >
            <UserCog className="h-4 w-4 flex-shrink-0" />
            <span>{t("users")}</span>
          </Link>
        </div>
      </nav>

      <Separator />

      {/* Sign out */}
      <div className="px-3 py-2">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span>{t("signOut")}</span>
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden w-60 flex-shrink-0 border-r bg-card transition-all duration-200 lg:flex lg:flex-col",
        !sidebarOpen && "lg:hidden"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SidebarContent onLinkClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex h-8 w-8"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <GlobalSearch />
              <LanguageSwitcher />
              <NotificationDropdown />
              <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1920px] p-3 sm:p-4 lg:p-6 2xl:px-10">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
