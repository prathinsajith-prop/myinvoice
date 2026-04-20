"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
    Loader2,
    Plus,
    Copy,
    Check,
    Trash2,
    Eye,
    ShieldAlert,
    Blocks,
    KeyRound,
    Activity,
    Clock,
    Shield,
    TriangleAlert,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGate } from "@/components/tenant/permission-gate";
import { jsonFetcher } from "@/lib/fetcher";
import { CreateAppSheet } from "@/components/modals/create-app-sheet";

interface ConnectedApp {
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
}

interface SecretResponse {
    id?: string;
    apiSecret?: string;
}

function CopyableField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);
    const t = useTranslations("settings.apps");

    function handleCopy() {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(t("copied"));
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
            </label>
            <div className="flex items-start gap-2">
                <code className={`flex-1 break-all rounded-md border bg-muted/50 px-3 py-2.5 text-sm leading-relaxed ${mono ? "font-mono" : ""}`}>
                    {value}
                </code>
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9 w-9 mt-0.5"
                    onClick={handleCopy}
                    title="Copy to clipboard"
                >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}

export default function AppsPage() {
    const t = useTranslations("settings.apps");
    const router = useRouter();
    const { data, isLoading, mutate } = useSWR<{ data: ConnectedApp[] }>(
        "/api/apps",
        jsonFetcher,
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<ConnectedApp | null>(null);
    const [regenTarget, setRegenTarget] = useState<{
        app: ConnectedApp;
        type: "secret";
    } | null>(null);
    const [secretDialog, setSecretDialog] = useState<SecretResponse | null>(
        null,
    );
    const [revoking, setRevoking] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const apps = data?.data ?? [];

    async function handleRevoke() {
        if (!revokeTarget) return;
        setRevoking(true);
        try {
            await fetch(`/api/apps/${revokeTarget.id}`, { method: "DELETE" });
            toast.success(t("revokedSuccess"));
            mutate();
        } catch {
            toast.error("Failed to revoke app");
        } finally {
            setRevoking(false);
            setRevokeTarget(null);
        }
    }

    async function handleRegenerate() {
        if (!regenTarget) return;
        setRegenerating(true);
        try {
            const endpoint = `/api/apps/${regenTarget.app.id}/regenerate-secret`;
            const res = await fetch(endpoint, { method: "POST" });
            const json = await res.json();
            setSecretDialog(json.data);
            toast.success(t("secretRegenerated"));
        } catch {
            toast.error("Failed to regenerate");
        } finally {
            setRegenerating(false);
            setRegenTarget(null);
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        toast.success(t("copied"));
    }

    return (
        <PermissionGate permission="manage_org">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">{t("title")}</h2>
                        <p className="text-sm text-muted-foreground">
                            {t("description")}
                        </p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("createApp")}
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : apps.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Blocks className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-medium">
                                {t("noApps")}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t("noAppsDesc")}
                            </p>
                            <Button
                                className="mt-4"
                                onClick={() => setCreateOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                {t("createApp")}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {apps.map((app) => (
                            <Card
                                key={app.id}
                                className={`cursor-pointer transition-shadow hover:shadow-md ${app.status === "REVOKED" ? "opacity-60" : ""}`}
                                onClick={() => router.push(`/apps/${app.id}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                {app.name}
                                                <Badge
                                                    variant={
                                                        app.status === "ACTIVE"
                                                            ? "default"
                                                            : "destructive"
                                                    }
                                                    className="text-[10px] shrink-0"
                                                >
                                                    {app.status === "ACTIVE"
                                                        ? t("active")
                                                        : t("revoked")}
                                                </Badge>
                                            </CardTitle>
                                            {app.description && (
                                                <CardDescription className="text-sm">
                                                    {app.description}
                                                </CardDescription>
                                            )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8"
                                                onClick={() => router.push(`/apps/${app.id}`)}
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                {t("viewDetails")}
                                            </Button>
                                            {app.status === "ACTIVE" && (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() =>
                                                            setRegenTarget({
                                                                app,
                                                                type: "secret",
                                                            })
                                                        }
                                                    >
                                                        <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                                                        {t("regenerateSecret")}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-destructive hover:text-destructive"
                                                        onClick={() =>
                                                            setRevokeTarget(app)
                                                        }
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                        {t("revokeApp")}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* App ID - full, visible, copyable */}
                                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                                        <span className="text-xs font-medium text-muted-foreground shrink-0">App ID</span>
                                        <code className="flex-1 truncate text-xs font-mono">{app.id}</code>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0"
                                            onClick={() => copyToClipboard(app.id)}
                                            title="Copy App ID"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    {/* Stats row */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground">{t("scopes")}:</span>
                                            <strong className="text-foreground">{app.scopes.length}</strong>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground">{t("requestCount")}:</span>
                                            <strong className="text-foreground">{app.requestCount.toLocaleString()}</strong>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground">{t("lastUsed")}:</span>
                                            <strong className="text-foreground">
                                                {app.lastUsedAt
                                                    ? formatDistanceToNow(
                                                        new Date(app.lastUsedAt),
                                                        { addSuffix: true },
                                                    )
                                                    : t("never")}
                                            </strong>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground">{t("createdAt")}:</span>
                                            <strong className="text-foreground">
                                                {formatDistanceToNow(
                                                    new Date(app.createdAt),
                                                    { addSuffix: true },
                                                )}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Restrictions badges */}
                                    {app.ipWhitelist.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            <Badge variant="outline" className="text-[10px]">
                                                IP whitelist ({app.ipWhitelist.length})
                                            </Badge>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Create App Sheet */}
                <CreateAppSheet
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    onCreated={(result) => {
                        mutate();
                        sessionStorage.setItem(`app_new_secret_${result.id}`, result.apiSecret);
                        router.push(`/apps/${result.id}`);
                    }}
                />

                {/* Revoke Confirmation */}
                <AlertDialog
                    open={!!revokeTarget}
                    onOpenChange={() => setRevokeTarget(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                <ShieldAlert className="mr-2 inline h-5 w-5 text-destructive" />
                                {t("revokeTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("revokeConfirm")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRevoke}
                                disabled={revoking}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {revoking ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                {t("revokeApp")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Regenerate Confirmation */}
                <AlertDialog
                    open={!!regenTarget}
                    onOpenChange={() => setRegenTarget(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {t("regenerateSecret")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("regenerateSecretConfirm")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRegenerate}
                                disabled={regenerating}
                            >
                                {regenerating ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Regenerate
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Secret Display Dialog */}
                <Dialog
                    open={!!secretDialog}
                    onOpenChange={() => {
                        const appId = secretDialog?.id;
                        setSecretDialog(null);
                        if (appId) router.push(`/apps/${appId}`);
                    }}
                >
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                <KeyRound className="h-5 w-5 text-amber-500" />
                                {t("secretsTitle")}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
                            <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 dark:text-amber-300">{t("secretWarning")}</p>
                        </div>

                        <div className="space-y-4">
                            {secretDialog?.id && (
                                <CopyableField
                                    label="App ID — used in the URL path"
                                    value={secretDialog.id}
                                />
                            )}
                            {secretDialog?.apiSecret && (
                                <CopyableField
                                    label="API Secret — X-Api-Secret header"
                                    value={secretDialog.apiSecret}
                                />
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                className="w-full sm:w-auto"
                                onClick={() => {
                                    const appId = secretDialog?.id;
                                    setSecretDialog(null);
                                    if (appId) router.push(`/apps/${appId}`);
                                }}
                            >
                                Done, I&apos;ve saved my credentials
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </PermissionGate>
    );
}
