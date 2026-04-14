import {
    Clock,
    DollarSign,
    FileText,
    Users,
    type LucideIcon,
} from "lucide-react";

export interface DashboardStat {
    name: string;
    value: string;
    change: string;
    trend: "up" | "down";
    icon: LucideIcon;
    description: string;
}

export interface DashboardInvoice {
    id: string;
    customer: string;
    amount: string;
    status: "paid" | "pending" | "overdue";
    date: string;
}

export const DASHBOARD_STATS: DashboardStat[] = [
    {
        name: "Total Revenue",
        value: "AED 124,500",
        change: "+12.5%",
        trend: "up",
        icon: DollarSign,
        description: "This month",
    },
    {
        name: "Outstanding",
        value: "AED 45,200",
        change: "-8.1%",
        trend: "down",
        icon: Clock,
        description: "Receivables",
    },
    {
        name: "Total Invoices",
        value: "156",
        change: "+23",
        trend: "up",
        icon: FileText,
        description: "This month",
    },
    {
        name: "Active Customers",
        value: "48",
        change: "+5",
        trend: "up",
        icon: Users,
        description: "Total",
    },
];

export const DASHBOARD_RECENT_INVOICES: DashboardInvoice[] = [
    {
        id: "INV-001",
        customer: "Dubai Tech Solutions",
        amount: "AED 12,500",
        status: "paid",
        date: "2024-01-15",
    },
    {
        id: "INV-002",
        customer: "Emirates Trading Co",
        amount: "AED 8,750",
        status: "pending",
        date: "2024-01-14",
    },
    {
        id: "INV-003",
        customer: "Abu Dhabi Consulting",
        amount: "AED 25,000",
        status: "overdue",
        date: "2024-01-10",
    },
    {
        id: "INV-004",
        customer: "Sharjah Industries",
        amount: "AED 5,200",
        status: "paid",
        date: "2024-01-08",
    },
    {
        id: "INV-005",
        customer: "Al Ain Services LLC",
        amount: "AED 15,800",
        status: "pending",
        date: "2024-01-05",
    },
];

export const DASHBOARD_QUICK_ACTIONS = [
    { name: "Create Invoice", href: "/invoices?create=1" },
    { name: "Add Customer", href: "/customers?create=1" },
    { name: "New Quotation", href: "/quotations?create=1" },
    { name: "Record Expense", href: "/expenses?create=1" },
];
