"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
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
  Settings,
  ChevronDown,
  Menu,
  Plus,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { UserProfileDropdown } from "@/components/user/user-profile-dropdown";
import { OrgSwitcher } from "@/components/tenant/org-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration guard
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
          {theme === "light" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
          {theme === "dark" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
          {theme === "system" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard };
type NavSection = { label?: string; items: NavItem[] };

const navigation: NavSection[] = [
  {
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Sales",
    items: [
      { name: "Invoices", href: "/invoices", icon: FileText },
      { name: "Quotations", href: "/quotations", icon: FileCheck },
      { name: "Credit Notes", href: "/credit-notes", icon: FileMinus },
      { name: "Debit Notes", href: "/debit-notes", icon: FilePlus },
      { name: "Customers", href: "/customers", icon: Users },
    ],
  },
  {
    label: "Purchases",
    items: [
      { name: "Bills", href: "/bills", icon: Receipt },
      { name: "Suppliers", href: "/suppliers", icon: Building2 },
      { name: "Expenses", href: "/expenses", icon: CreditCard },
    ],
  },
  {
    label: "Catalog",
    items: [
      { name: "Products", href: "/products", icon: Package },
    ],
  },
  {
    label: "Finance",
    items: [
      { name: "Reports", href: "/reports", icon: BarChart3 },
      { name: "VAT Returns", href: "/vat-returns", icon: Receipt },
    ],
  },
];

const bottomNavigation = [
  { name: "Users", href: "/users", icon: Users },
  { name: "Organizations", href: "/organizations", icon: Building2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">myinvoice.ae</span>
        </Link>
      </div>

      <Separator />

      {/* Organization Switcher */}
      <div className="px-3 py-2">
        <OrgSwitcher />
      </div>

      <Separator />

      {/* Quick Actions */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/invoices?create=1">
                <FileText className="mr-2 h-4 w-4" />
                Invoice
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/quotations?create=1">
                <FileCheck className="mr-2 h-4 w-4" />
                Quotation
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/customers?create=1">
                <Users className="mr-2 h-4 w-4" />
                Customer
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/suppliers?create=1">
                <Building2 className="mr-2 h-4 w-4" />
                Supplier
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/products?create=1">
                <Package className="mr-2 h-4 w-4" />
                Product
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {navigation.map((section, sIdx) => (
          <div key={sIdx} className={cn(sIdx > 0 && "mt-4")}>
            {section.label && (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onLinkClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Separator />

      {/* Bottom Navigation */}
      <nav className="p-3">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden w-64 flex-shrink-0 border-r bg-card transition-all duration-200 lg:block",
        !sidebarOpen && "lg:hidden"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onLinkClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
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
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <ThemeToggle />
              <NotificationDropdown />
              <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1920px] p-3 sm:p-4 lg:p-6 2xl:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
