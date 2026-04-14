import {
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Stats data (placeholder)
const stats = [
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

// Recent invoices (placeholder)
const recentInvoices = [
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

// Quick actions
const quickActions = [
  { name: "Create Invoice", href: "/invoices/new" },
  { name: "Add Customer", href: "/customers/new" },
  { name: "New Quotation", href: "/quotations/new" },
  { name: "Record Expense", href: "/expenses/new" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>;
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back! 👋
          </h2>
          <p className="text-muted-foreground">
            Here's what's happening with your business today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
                )}
                <span
                  className={
                    stat.trend === "up" ? "text-green-500" : "text-red-500"
                  }
                >
                  {stat.change}
                </span>
                <span className="ml-1">{stat.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Recent Invoices */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>
              Your latest invoices and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{invoice.customer}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.id} • {invoice.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{invoice.amount}</span>
                    {getStatusBadge(invoice.status)}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-4 w-full">
              View All Invoices
            </Button>
          </CardContent>
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-6 lg:col-span-3">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks at your fingertips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.name}
                    variant="outline"
                    className="h-auto py-3"
                    asChild
                  >
                    <a href={action.href}>{action.name}</a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* VAT Compliance Alert */}
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-600">VAT Return Due</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Your Q4 2024 VAT return is due in 15 days. Make sure all
                invoices are recorded and compliant.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                View VAT Summary
              </Button>
            </CardContent>
          </Card>

          {/* Revenue Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
              <CardDescription>Monthly revenue trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[200px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Revenue chart coming soon
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
