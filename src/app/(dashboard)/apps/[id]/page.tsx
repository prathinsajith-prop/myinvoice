"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { formatDistanceToNow, format } from "date-fns";
import {
    ArrowLeft,
    Activity,
    CheckCircle2,
    XCircle,
    Zap,
    Globe,
    Shield,
    Copy,
    Check,
    Loader2,
    ShieldAlert,
    Code,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    BarChart3,
    KeyRound,
    Trash2,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
    AreaChart,
    Area,
    LineChart,
    Line,
} from "recharts";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/loading-state";
import { PermissionGate } from "@/components/tenant/permission-gate";
import { jsonFetcher } from "@/lib/fetcher";

/* ─── Helpers ─── */

const SCOPE_METHOD_MAP: Record<string, string[]> = {
    read: ["GET"],
    write: ["POST", "PUT", "PATCH"],
    delete: ["DELETE"],
};

function deriveEndpoints(scopes: string[]): { method: string; module: string; scope: string }[] {
    const endpoints: { method: string; module: string; scope: string }[] = [];
    for (const scope of scopes) {
        const [mod, action] = scope.split(":");
        const methods = SCOPE_METHOD_MAP[action];
        if (methods) {
            for (const method of methods) {
                endpoints.push({ method, module: mod, scope });
            }
        }
    }
    const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    return endpoints.sort((a, b) =>
        a.module.localeCompare(b.module) || methodOrder.indexOf(a.method) - methodOrder.indexOf(b.method)
    );
}

function getEnabledModules(scopes: string[]): string[] {
    const modules = new Set<string>();
    for (const scope of scopes) {
        const [mod] = scope.split(":");
        modules.add(mod);
    }
    return Array.from(modules).sort();
}

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
}

/* ─── Types ─── */

interface AppReport {
    app: {
        id: string;
        name: string;
        description: string | null;
        status: "ACTIVE" | "REVOKED";
        scopes: string[];
        ipWhitelist: string[];
        lastUsedAt: string | null;
        requestCount: number;
        createdAt: string;
        updatedAt: string;
        revokedAt: string | null;
    };
    stats: {
        totalRequests: number;
        successCount: number;
        errorCount: number;
        successRate: number;
        avgLatencyMs: number;
        maxLatencyMs: number;
        minLatencyMs: number;
        last24h: number;
        last7d: number;
    };
    moduleBreakdown: { module: string; count: number }[];
    methodBreakdown: { method: string; count: number }[];
    statusBreakdown: { statusCode: number; count: number }[];
    topErrors: { error: string; count: number }[];
    recentLogs: {
        id: string;
        method: string;
        path: string;
        module: string;
        statusCode: number;
        duration: number;
        ipAddress: string | null;
        error: string | null;
        createdAt: string;
    }[];
    hourlyVolume: { hour: string; total: number; errors: number }[];
    dailyVolume: { day: string; total: number; errors: number; avgLatency: number }[];
}

/* ─── Constants ─── */

const CHART_COLORS = [
    "#2563eb", "#16a34a", "#eab308", "#dc2626", "#8b5cf6",
    "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1",
];

const METHOD_COLORS: Record<string, string> = {
    GET: "#2563eb",
    POST: "#16a34a",
    PUT: "#eab308",
    PATCH: "#f97316",
    DELETE: "#dc2626",
};

function statusColor(code: number) {
    if (code < 300) return "text-green-600";
    if (code < 400) return "text-yellow-600";
    return "text-red-600";
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    return status === "ACTIVE" ? "default" : "destructive";
}

/* ─── Copy helper ─── */
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
        >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

/* ─── KPI Card ─── */
function KpiCard({
    label,
    value,
    subValue,
    icon: Icon,
    iconColor,
    trend,
}: {
    label: string;
    value: string | number;
    subValue?: string;
    icon: React.ElementType;
    iconColor: string;
    trend?: "up" | "down" | "neutral";
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold tracking-tight">{value}</p>
                        {subValue && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                                {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                                {subValue}
                            </p>
                        )}
                    </div>
                    <div className={`rounded-lg p-2.5 ${iconColor}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Main Page ─── */

export default function AppReportPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const { data, isLoading, error, mutate } = useSWR<{ data: AppReport }>(
        `/api/apps/${id}/report`,
        jsonFetcher,
    );

    const [regenOpen, setRegenOpen] = useState(false);
    const [revokeOpen, setRevokeOpen] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [revoking, setRevoking] = useState(false);
    const [secretDialog, setSecretDialog] = useState<{ apiSecret: string } | null>(null);

    async function handleRegenerate() {
        setRegenerating(true);
        try {
            const res = await fetch(`/api/apps/${id}/regenerate-secret`, { method: "POST" });
            const json = await res.json();
            setSecretDialog(json.data);
            toast.success("API secret regenerated successfully");
            mutate();
        } catch {
            toast.error("Failed to regenerate secret");
        } finally {
            setRegenerating(false);
            setRegenOpen(false);
        }
    }

    async function handleRevoke() {
        setRevoking(true);
        try {
            await fetch(`/api/apps/${id}`, { method: "DELETE" });
            toast.success("App revoked successfully");
            router.push("/apps");
        } catch {
            toast.error("Failed to revoke app");
        } finally {
            setRevoking(false);
            setRevokeOpen(false);
        }
    }

    if (isLoading) {
        return (
            <PermissionGate permission="manage_org">
                <div className="space-y-6 p-6">
                    <LoadingState variant="card" rows={4} />
                </div>
            </PermissionGate>
        );
    }

    if (error || !data?.data) {
        return (
            <PermissionGate permission="manage_org">
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                    <XCircle className="h-10 w-10 text-muted-foreground" />
                    <p className="text-muted-foreground">Failed to load report data.</p>
                    <Button variant="outline" onClick={() => router.back()}>
                        Go Back
                    </Button>
                </div>
            </PermissionGate>
        );
    }

    const report = data.data;
    const { app, stats } = report;

    // Compute percentage change: last24h vs (last7d - last24h) / 6 days avg
    const dailyAvg7d = stats.last7d > 0 ? (stats.last7d - stats.last24h) / 6 : 0;
    const trendPct = dailyAvg7d > 0
        ? Math.round(((stats.last24h - dailyAvg7d) / dailyAvg7d) * 100)
        : 0;

    return (
        <PermissionGate permission="manage_org">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/apps")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight truncate">{app.name}</h1>
                            <Badge variant={statusBadgeVariant(app.status)}>{app.status}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm truncate">
                            {app.description || "API usage report and analytics"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => mutate()}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                        {app.status === "ACTIVE" && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRegenOpen(true)}
                                >
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Regenerate Secret
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setRevokeOpen(true)}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Revoke
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* App Info Bar */}
                <Card className="bg-muted/30">
                    <CardContent className="py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground text-xs uppercase tracking-wider">App ID</span>
                                <div className="flex items-center gap-1.5 font-mono font-medium text-sm mt-0.5">
                                    <span className="truncate">{app.id}</span>
                                    <CopyButton text={app.id} />
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase tracking-wider">Status</span>
                                <div className="font-medium mt-0.5">
                                    <Badge variant={statusBadgeVariant(app.status)} className="text-xs">
                                        {app.status}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase tracking-wider">Created</span>
                                <div className="font-medium mt-0.5">
                                    {format(new Date(app.createdAt), "MMM d, yyyy")}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase tracking-wider">Last Active</span>
                                <div className="font-medium mt-0.5">
                                    {app.lastUsedAt
                                        ? formatDistanceToNow(new Date(app.lastUsedAt), { addSuffix: true })
                                        : "Never"}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase tracking-wider">Modules</span>
                                <div className="font-medium mt-0.5">{getEnabledModules(app.scopes).length} active</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* KPI Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard
                        label="Total Requests"
                        value={stats.totalRequests.toLocaleString()}
                        subValue={`${stats.last7d.toLocaleString()} last 7d`}
                        icon={Activity}
                        iconColor="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                    />
                    <KpiCard
                        label="Last 24 Hours"
                        value={stats.last24h.toLocaleString()}
                        subValue={trendPct !== 0 ? `${trendPct > 0 ? "+" : ""}${trendPct}% vs avg` : "Stable"}
                        icon={TrendingUp}
                        iconColor="bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
                        trend={trendPct > 0 ? "up" : trendPct < 0 ? "down" : "neutral"}
                    />
                    <KpiCard
                        label="Success Rate"
                        value={`${stats.successRate}%`}
                        subValue={`${stats.successCount.toLocaleString()} successful`}
                        icon={CheckCircle2}
                        iconColor={stats.successRate >= 95 ? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400" : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"}
                        trend={stats.successRate >= 95 ? "up" : "down"}
                    />
                    <KpiCard
                        label="Errors"
                        value={stats.errorCount.toLocaleString()}
                        subValue={stats.totalRequests > 0 ? `${(100 - stats.successRate).toFixed(1)}% error rate` : "No traffic"}
                        icon={AlertTriangle}
                        iconColor={stats.errorCount > 0 ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"}
                    />
                    <KpiCard
                        label="Avg Latency"
                        value={`${stats.avgLatencyMs}ms`}
                        subValue={`${stats.minLatencyMs}ms – ${stats.maxLatencyMs}ms range`}
                        icon={Zap}
                        iconColor="bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400"
                    />
                </div>

                {/* Tabs */}
                <Tabs defaultValue="overview">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="api-usage">API Docs</TabsTrigger>
                        <TabsTrigger value="logs">Request Logs</TabsTrigger>
                        <TabsTrigger value="errors">Errors</TabsTrigger>
                        <TabsTrigger value="config">Configuration</TabsTrigger>
                    </TabsList>

                    {/* ── Overview Tab ── */}
                    <TabsContent value="overview" className="space-y-6 mt-4">
                        {/* Traffic Over Time — Area Chart */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4" />
                                            Traffic Over Time
                                        </CardTitle>
                                        <CardDescription>Daily request volume (last 30 days)</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {report.dailyVolume.length === 0 ? (
                                    <p className="text-muted-foreground text-sm py-12 text-center">No data yet — make some API calls to see traffic trends.</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={report.dailyVolume}>
                                            <defs>
                                                <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis
                                                dataKey="day"
                                                tickFormatter={(v) => format(new Date(v), "MMM d")}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <RechartsTooltip
                                                labelFormatter={(v) => format(new Date(v as string), "MMM d, yyyy")}
                                                formatter={(value, name) => [String(value ?? 0), name === "total" ? "Total" : "Errors"]}
                                            />
                                            <Area type="monotone" dataKey="total" stroke="#2563eb" fill="url(#totalGradient)" strokeWidth={2} name="total" />
                                            <Area type="monotone" dataKey="errors" stroke="#dc2626" fill="url(#errorGradient)" strokeWidth={2} name="errors" />
                                            <Legend />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        {/* Hourly Traffic + Latency */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Hourly Requests */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Hourly Requests (7d)</CardTitle>
                                    <CardDescription>Requests per hour over the last 7 days</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {report.hourlyVolume.length === 0 ? (
                                        <p className="text-muted-foreground text-sm py-8 text-center">No data yet</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={240}>
                                            <BarChart data={report.hourlyVolume}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis
                                                    dataKey="hour"
                                                    tickFormatter={(v) => format(new Date(v), "M/d HH:mm")}
                                                    tick={{ fontSize: 10 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <RechartsTooltip
                                                    labelFormatter={(v) => format(new Date(v as string), "MMM d, HH:mm")}
                                                />
                                                <Bar dataKey="total" fill="#2563eb" radius={[2, 2, 0, 0]} name="Requests" />
                                                <Bar dataKey="errors" fill="#dc2626" radius={[2, 2, 0, 0]} name="Errors" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Daily Latency */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Avg Latency Trend (30d)</CardTitle>
                                    <CardDescription>Average response time per day</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {report.dailyVolume.length === 0 ? (
                                        <p className="text-muted-foreground text-sm py-8 text-center">No data yet</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={240}>
                                            <LineChart data={report.dailyVolume}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis
                                                    dataKey="day"
                                                    tickFormatter={(v) => format(new Date(v), "M/d")}
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <YAxis tick={{ fontSize: 11 }} unit="ms" />
                                                <RechartsTooltip
                                                    labelFormatter={(v) => format(new Date(v as string), "MMM d, yyyy")}
                                                    formatter={(value) => [`${value ?? 0}ms`, "Avg Latency"]}
                                                />
                                                <Line type="monotone" dataKey="avgLatency" stroke="#eab308" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Breakdown Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Module Breakdown */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">By Module</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {report.moduleBreakdown.length === 0 ? (
                                        <p className="text-muted-foreground text-sm py-8 text-center">No data yet</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={report.moduleBreakdown} layout="vertical">
                                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                                    <YAxis dataKey="module" type="category" width={100} tick={{ fontSize: 11 }} />
                                                    <RechartsTooltip />
                                                    <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                            {/* Module list with percentages */}
                                            <div className="mt-4 space-y-2">
                                                {report.moduleBreakdown.map((m) => {
                                                    const pct = stats.totalRequests > 0 ? Math.round((m.count / stats.totalRequests) * 100) : 0;
                                                    return (
                                                        <div key={m.module} className="flex items-center justify-between text-sm">
                                                            <span className="font-mono text-xs">{m.module}</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                                                </div>
                                                                <span className="text-xs text-muted-foreground w-12 text-right">{m.count.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Method Breakdown */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">By Method</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {report.methodBreakdown.length === 0 ? (
                                        <p className="text-muted-foreground text-sm py-8 text-center">No data yet</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <PieChart>
                                                    <Pie
                                                        data={report.methodBreakdown}
                                                        dataKey="count"
                                                        nameKey="method"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={80}
                                                        paddingAngle={2}
                                                    >
                                                        {report.methodBreakdown.map((entry, i) => (
                                                            <Cell
                                                                key={entry.method}
                                                                fill={METHOD_COLORS[entry.method] || CHART_COLORS[i % CHART_COLORS.length]}
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="mt-2 space-y-1.5">
                                                {report.methodBreakdown.map((m) => (
                                                    <div key={m.method} className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: METHOD_COLORS[m.method] || "#888" }} />
                                                            <Badge variant="outline" className="font-mono text-xs">{m.method}</Badge>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">{m.count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Status Code Breakdown */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Status Codes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {report.statusBreakdown.length === 0 ? (
                                        <p className="text-muted-foreground text-sm py-8 text-center">No data yet</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={report.statusBreakdown}>
                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                    <XAxis dataKey="statusCode" tick={{ fontSize: 11 }} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <RechartsTooltip />
                                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                        {report.statusBreakdown.map((entry) => (
                                                            <Cell
                                                                key={entry.statusCode}
                                                                fill={
                                                                    entry.statusCode < 300 ? "#16a34a" :
                                                                        entry.statusCode < 400 ? "#eab308" : "#dc2626"
                                                                }
                                                            />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                            <div className="mt-2 space-y-1.5">
                                                {report.statusBreakdown.map((s) => (
                                                    <div key={s.statusCode} className="flex items-center justify-between text-sm">
                                                        <span className={`font-mono font-semibold ${statusColor(s.statusCode)}`}>{s.statusCode}</span>
                                                        <span className="text-xs text-muted-foreground">{s.count.toLocaleString()} requests</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Performance Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Performance Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <p className="text-2xl font-bold text-green-600">{stats.minLatencyMs}ms</p>
                                        <p className="text-xs text-muted-foreground mt-1">Min Latency</p>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <p className="text-2xl font-bold text-blue-600">{stats.avgLatencyMs}ms</p>
                                        <p className="text-xs text-muted-foreground mt-1">Avg Latency</p>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <p className="text-2xl font-bold text-orange-600">{stats.maxLatencyMs}ms</p>
                                        <p className="text-xs text-muted-foreground mt-1">Max Latency</p>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <p className="text-2xl font-bold">{stats.last24h.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Last 24h</p>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <p className="text-2xl font-bold">{stats.last7d.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Last 7 Days</p>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <p className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground mt-1">All Time</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── API Usage Tab ── */}
                    <TabsContent value="api-usage" className="space-y-6 mt-4">
                        {/* Authentication */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4" />
                                    Authentication
                                </CardTitle>
                                <CardDescription>How to authenticate your API requests</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm text-muted-foreground">
                                    <p>Every API request requires two things:</p>
                                    <ol className="list-decimal list-inside space-y-1.5">
                                        <li>
                                            <strong className="text-foreground">App ID in the URL</strong> — identifies your app in the API path
                                        </li>
                                        <li>
                                            <strong className="text-foreground">X-Api-Secret header</strong> — the 64-character secret shown at creation
                                        </li>
                                    </ol>
                                    <div className="rounded bg-muted px-3 py-2.5 font-mono text-foreground text-sm space-y-0.5">
                                        <div>POST https://myinvoice.ae/api/ext/<span className="text-blue-500">{app.id}</span>/invoices</div>
                                        <div>X-Api-Secret: <span className="text-green-500">{"<your-api-secret>"}</span></div>
                                        <div>Content-Type: application/json</div>
                                    </div>
                                    <div className="flex items-start gap-2 rounded bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs">
                                            The <strong className="text-foreground">API Secret</strong> is only shown once when you create the app.
                                            If you lost it, regenerate a new one from the app menu.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* cURL Examples */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Code className="h-4 w-4" />
                                    cURL Examples
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    const modules = getEnabledModules(app.scopes);
                                    const firstMod = modules[0] ?? "invoices";
                                    return (
                                        <div className="relative">
                                            <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto font-mono leading-relaxed">
                                                {`# List ${firstMod}
curl -X GET https://myinvoice.ae/api/ext/${app.id}/${firstMod} \\
  -H "X-Api-Secret: <your-api-secret>" \\
  -H "Content-Type: application/json"

# Get single ${firstMod.replace(/-/g, " ").replace(/s$/, "")} by ID
curl -X GET https://myinvoice.ae/api/ext/${app.id}/${firstMod}/<record-id> \\
  -H "X-Api-Secret: <your-api-secret>"

# Create (POST)
curl -X POST https://myinvoice.ae/api/ext/${app.id}/${firstMod} \\
  -H "X-Api-Secret: <your-api-secret>" \\
  -H "Content-Type: application/json" \\
  -d '{ ... }'`}
                                            </pre>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="absolute top-2 right-2 h-7 text-[10px]"
                                                onClick={() => copyToClipboard(
                                                    `curl -X GET https://myinvoice.ae/api/ext/${app.id}/${firstMod} \\\n  -H "X-Api-Secret: <your-api-secret>" \\\n  -H "Content-Type: application/json"`
                                                )}
                                            >
                                                <Copy className="h-3 w-3 mr-1" />
                                                Copy
                                            </Button>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>

                        {/* JavaScript / Fetch */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">JavaScript / Fetch</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    const modules = getEnabledModules(app.scopes);
                                    const firstMod = modules[0] ?? "invoices";
                                    return (
                                        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto font-mono leading-relaxed">
                                            {`const APP_ID = "${app.id}";
const API_SECRET = "<your-api-secret>";

// List ${firstMod}
const response = await fetch(
  \`https://myinvoice.ae/api/ext/\${APP_ID}/${firstMod}?page=1&limit=20\`,
  {
    headers: {
      "X-Api-Secret": API_SECRET,
      "Content-Type": "application/json",
    },
  }
);
const { data, pagination } = await response.json();`}
                                        </pre>
                                    );
                                })()}
                            </CardContent>
                        </Card>

                        {/* Enabled Endpoints */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Enabled Endpoints</CardTitle>
                                <CardDescription>
                                    Base URL: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">https://myinvoice.ae/api/ext/{app.id}</code>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {deriveEndpoints(app.scopes).length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No scopes configured.</p>
                                ) : (
                                    <div className="rounded-lg border">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/50">
                                                    <th className="px-3 py-2 text-left font-medium">Method</th>
                                                    <th className="px-3 py-2 text-left font-medium">Endpoint</th>
                                                    <th className="px-3 py-2 text-left font-medium">Scope</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deriveEndpoints(app.scopes).map(({ method, module: mod, scope }) => (
                                                    <tr key={`${method}-${mod}-${scope}`} className="border-b last:border-0">
                                                        <td className="px-3 py-1.5">
                                                            <Badge variant="outline" className="text-xs font-mono" style={{ color: METHOD_COLORS[method] }}>
                                                                {method}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-1.5 font-mono text-sm">/{mod}</td>
                                                        <td className="px-3 py-1.5">
                                                            <Badge variant="secondary" className="text-xs">
                                                                {scope}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground italic mt-3">
                                    Every request must include the <code className="rounded bg-muted px-1 py-0.5">X-Api-Secret</code> header.
                                    Append <code className="rounded bg-muted px-1 py-0.5">/{'<id>'}</code> to GET a single record, PATCH, or DELETE.
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Request Logs Tab ── */}
                    <TabsContent value="logs" className="mt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">Recent Requests</CardTitle>
                                        <CardDescription>Last 50 API requests</CardDescription>
                                    </div>
                                    <Badge variant="outline">{report.recentLogs.length} entries</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {report.recentLogs.length === 0 ? (
                                    <div className="flex flex-col items-center py-12 gap-2">
                                        <Activity className="h-8 w-8 text-muted-foreground/50" />
                                        <p className="text-muted-foreground text-sm">
                                            No requests logged yet — make your first API call to see logs here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-muted-foreground">
                                                    <th className="pb-2 pr-4 font-medium">Time</th>
                                                    <th className="pb-2 pr-4 font-medium">Method</th>
                                                    <th className="pb-2 pr-4 font-medium">Module</th>
                                                    <th className="pb-2 pr-4 font-medium">Status</th>
                                                    <th className="pb-2 pr-4 font-medium">Latency</th>
                                                    <th className="pb-2 pr-4 font-medium">IP</th>
                                                    <th className="pb-2 font-medium">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.recentLogs.map((log) => (
                                                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                        <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground text-xs">
                                                            {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                                                        </td>
                                                        <td className="py-2 pr-4">
                                                            <Badge
                                                                variant="outline"
                                                                className="font-mono text-xs"
                                                                style={{ color: METHOD_COLORS[log.method] }}
                                                            >
                                                                {log.method}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-2 pr-4 font-mono text-xs">{log.module}</td>
                                                        <td className={`py-2 pr-4 font-mono font-semibold ${statusColor(log.statusCode)}`}>
                                                            {log.statusCode}
                                                        </td>
                                                        <td className="py-2 pr-4 text-muted-foreground text-xs">
                                                            <span className={log.duration > 500 ? "text-orange-600 font-medium" : ""}>
                                                                {log.duration}ms
                                                            </span>
                                                        </td>
                                                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                                                            {log.ipAddress || "—"}
                                                        </td>
                                                        <td className="py-2 text-xs text-red-600 max-w-[200px] truncate">
                                                            {log.error || "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Errors Tab ── */}
                    <TabsContent value="errors" className="mt-4">
                        <div className="grid grid-cols-1 gap-6">
                            {/* Error Summary Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <KpiCard
                                    label="Total Errors"
                                    value={stats.errorCount.toLocaleString()}
                                    icon={XCircle}
                                    iconColor="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                                />
                                <KpiCard
                                    label="Error Rate"
                                    value={`${stats.totalRequests > 0 ? (100 - stats.successRate).toFixed(2) : 0}%`}
                                    icon={AlertTriangle}
                                    iconColor="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                                />
                                <KpiCard
                                    label="Unique Errors"
                                    value={report.topErrors.length}
                                    icon={BarChart3}
                                    iconColor="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                />
                            </div>

                            {/* Top Errors */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Top Errors</CardTitle>
                                    <CardDescription>Most frequent error messages</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {report.topErrors.length === 0 ? (
                                        <div className="flex flex-col items-center py-12 gap-2">
                                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                                            <p className="text-muted-foreground text-sm">No errors recorded — your API is running clean!</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {report.topErrors.map((err, i) => {
                                                const pct = stats.errorCount > 0 ? Math.round((err.count / stats.errorCount) * 100) : 0;
                                                return (
                                                    <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                                                        <div className="flex items-start gap-3">
                                                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-mono break-all">{err.error}</p>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <div className="flex-1 h-1.5 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                                                                    <Badge variant="destructive" className="shrink-0">{err.count}x</Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ── Configuration Tab ── */}
                    <TabsContent value="config" className="mt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Scopes */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Scopes</CardTitle>
                                    <CardDescription>Permitted module:action pairs</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {app.scopes.map((scope) => (
                                            <Badge key={scope} variant="secondary" className="font-mono text-xs">
                                                {scope}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* IP Whitelist */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">IP Whitelist</CardTitle>
                                    <CardDescription>Only these IPs can access the API</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {app.ipWhitelist.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {app.ipWhitelist.map((ip) => (
                                                <Badge key={ip} variant="outline" className="font-mono text-xs">
                                                    <Globe className="h-3 w-3 mr-1" />
                                                    {ip}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Shield className="h-4 w-4" />
                                            All IPs allowed (no whitelist configured)
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Revocation Status */}
                            {app.revokedAt && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Revocation</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                                            <p className="text-sm text-red-600 font-medium">
                                                Revoked {formatDistanceToNow(new Date(app.revokedAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Regenerate Secret Confirmation */}
                <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <KeyRound className="h-5 w-5" />
                                Regenerate API Secret
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This will invalidate the current API secret. Any applications using
                                the old secret will stop working immediately. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRegenerate} disabled={regenerating}>
                                {regenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Regenerate
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Revoke Confirmation */}
                <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-destructive" />
                                Revoke Application
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently revoke access for &quot;{app.name}&quot;.
                                All API requests using this app&apos;s credentials will be rejected.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRevoke}
                                disabled={revoking}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Revoke App
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Secret Display Dialog */}
                <Dialog open={!!secretDialog} onOpenChange={() => setSecretDialog(null)}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <KeyRound className="h-5 w-5" />
                                New API Secret
                            </DialogTitle>
                            <DialogDescription>
                                Copy your new API secret now. You won&apos;t be able to see it again.
                            </DialogDescription>
                        </DialogHeader>
                        {secretDialog?.apiSecret && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                    API Secret (X-Api-Secret header)
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 truncate rounded border bg-muted/50 px-3 py-2 text-sm font-mono">
                                        {secretDialog.apiSecret}
                                    </code>
                                    <CopyButton text={secretDialog.apiSecret} />
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </PermissionGate>
    );
}
