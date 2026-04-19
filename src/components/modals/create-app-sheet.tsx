"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronRight, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    APP_MODULES,
    SCOPE_ACTIONS,
} from "@/lib/constants/app-scopes";

const schema = z.object({
    name: z.string().min(1, "Name required").max(100),
    description: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateAppSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (result: { id: string; apiSecret: string }) => void;
}

/** Group modules by business domain for better UX. */
const SCOPE_GROUPS = [
    {
        label: "Sales",
        modules: [
            "invoices",
            "quotations",
            "credit-notes",
            "debit-notes",
            "delivery-notes",
            "recurring-invoices",
            "customers",
        ] as const,
    },
    {
        label: "Purchases",
        modules: [
            "bills",
            "purchase-orders",
            "suppliers",
            "expenses",
        ] as const,
    },
    {
        label: "Catalog & Finance",
        modules: [
            "products",
            "payments",
            "reports",
            "vat-returns",
            "organization",
        ] as const,
    },
];

export function CreateAppSheet({
    open,
    onOpenChange,
    onCreated,
}: CreateAppSheetProps) {
    const t = useTranslations("settings.apps");
    const [submitting, setSubmitting] = useState(false);
    const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
    const [ipWhitelist, setIpWhitelist] = useState("");

    const [expandedGroups, setExpandedGroups] = useState<string[]>(
        SCOPE_GROUPS.map((g) => g.label),
    );
    const [showAdvanced, setShowAdvanced] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    function toggleScope(scope: string) {
        setSelectedScopes((prev) =>
            prev.includes(scope)
                ? prev.filter((s) => s !== scope)
                : [...prev, scope],
        );
    }

    function toggleGroupScopes(
        modules: readonly string[],
        action: "add" | "remove",
    ) {
        const groupScopes = modules.flatMap((mod) =>
            SCOPE_ACTIONS.map((a) => `${mod}:${a}`),
        );
        if (action === "add") {
            setSelectedScopes((prev) => [
                ...new Set([...prev, ...groupScopes]),
            ]);
        } else {
            setSelectedScopes((prev) =>
                prev.filter((s) => !groupScopes.includes(s)),
            );
        }
    }

    function toggleAllScopes(action: "add" | "remove") {
        if (action === "add") {
            setSelectedScopes(
                APP_MODULES.flatMap((mod) =>
                    SCOPE_ACTIONS.map((a) => `${mod}:${a}`),
                ),
            );
        } else {
            setSelectedScopes([]);
        }
    }

    function isGroupFullySelected(modules: readonly string[]) {
        return modules.every((mod) =>
            SCOPE_ACTIONS.every((a) =>
                selectedScopes.includes(`${mod}:${a}`),
            ),
        );
    }

    function isGroupPartiallySelected(modules: readonly string[]) {
        return modules.some((mod) =>
            SCOPE_ACTIONS.some((a) =>
                selectedScopes.includes(`${mod}:${a}`),
            ),
        );
    }

    function toggleGroupExpand(label: string) {
        setExpandedGroups((prev) =>
            prev.includes(label)
                ? prev.filter((l) => l !== label)
                : [...prev, label],
        );
    }

    function handleClose(isOpen: boolean) {
        if (!isOpen) {
            reset();
            setSelectedScopes([]);
            setIpWhitelist("");
            setShowAdvanced(false);
            setExpandedGroups(SCOPE_GROUPS.map((g) => g.label));
        }
        onOpenChange(isOpen);
    }

    async function onSubmit(values: FormValues) {
        if (selectedScopes.length === 0) {
            toast.error("Select at least one scope");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/apps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...values,
                    scopes: selectedScopes,
                    ipWhitelist: ipWhitelist
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || "Failed to create app");
                return;
            }

            const json = await res.json();
            toast.success(t("created"));
            onCreated({
                id: json.data.id,
                apiSecret: json.data.apiSecret,
            });
            reset();
            setSelectedScopes([]);
            setIpWhitelist("");
            setShowAdvanced(false);
            onOpenChange(false);
        } catch {
            toast.error("Failed to create app");
        } finally {
            setSubmitting(false);
        }
    }

    const allSelected =
        selectedScopes.length === APP_MODULES.length * SCOPE_ACTIONS.length;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:!max-w-4xl !p-0 !gap-0 !overflow-hidden max-h-[90vh] flex flex-col">
                {/* ── Header ── */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <DialogTitle className="text-lg">
                        {t("createApp")}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {t("description")}
                    </DialogDescription>
                </DialogHeader>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    <form
                        id="create-app-form"
                        onSubmit={handleSubmit(onSubmit)}
                    >
                        <div className="px-6 py-5 space-y-6">
                            {/* ── Basic Info ── */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-semibold text-foreground">
                                    General Information
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="name" className="text-xs">
                                            {t("name")}{" "}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="name"
                                            placeholder={t("namePlaceholder")}
                                            {...register("name")}
                                        />
                                        {errors.name && (
                                            <p className="text-xs text-destructive">
                                                {errors.name.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="description" className="text-xs">
                                        {t("descriptionLabel")}
                                    </Label>
                                    <Textarea
                                        id="description"
                                        rows={2}
                                        placeholder={t("descriptionPlaceholder")}
                                        className="resize-none"
                                        {...register("description")}
                                    />
                                </div>
                            </section>

                            <Separator />

                            {/* ── Permissions / Scopes ── */}
                            <section className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">
                                            {t("scopes")}{" "}
                                            <span className="text-destructive">*</span>
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {t("scopesDesc")}
                                            {selectedScopes.length > 0 && (
                                                <span className="ml-2 font-medium text-foreground">
                                                    ({selectedScopes.length} selected)
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                            toggleAllScopes(
                                                allSelected ? "remove" : "add",
                                            )
                                        }
                                    >
                                        {allSelected ? "Deselect All" : "Select All"}
                                    </Button>
                                </div>

                                {/* Scope groups */}
                                <div className="space-y-2">
                                    {SCOPE_GROUPS.map((group) => {
                                        const isExpanded = expandedGroups.includes(group.label);
                                        const fullSel = isGroupFullySelected(group.modules);
                                        const partSel = isGroupPartiallySelected(group.modules);

                                        return (
                                            <div key={group.label} className="rounded-md border bg-card">
                                                {/* Group header */}
                                                <div className="flex items-center justify-between px-3 py-2">
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
                                                        onClick={() => toggleGroupExpand(group.label)}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                        )}
                                                        {group.label}
                                                        {fullSel && (
                                                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                                                                All
                                                            </Badge>
                                                        )}
                                                        {partSel && !fullSel && (
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                                                Partial
                                                            </Badge>
                                                        )}
                                                    </button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                                                        onClick={() =>
                                                            toggleGroupScopes(
                                                                group.modules,
                                                                fullSel ? "remove" : "add",
                                                            )
                                                        }
                                                    >
                                                        {fullSel ? "Clear" : "Select all"}
                                                    </Button>
                                                </div>

                                                {/* Table-style scope grid */}
                                                {isExpanded && (
                                                    <div className="border-t">
                                                        {/* Column headers */}
                                                        <div className="grid grid-cols-[1fr_80px_80px_80px] items-center px-3 py-1.5 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                                            <span>Module</span>
                                                            <span className="text-center">Read</span>
                                                            <span className="text-center">Write</span>
                                                            <span className="text-center">Delete</span>
                                                        </div>
                                                        {/* Module rows */}
                                                        {group.modules.map((mod, idx) => (
                                                            <div
                                                                key={mod}
                                                                className={`grid grid-cols-[1fr_80px_80px_80px] items-center px-3 py-1.5 ${idx < group.modules.length - 1 ? "border-b border-dashed" : ""
                                                                    } hover:bg-muted/30 transition-colors`}
                                                            >
                                                                <span className="text-sm capitalize">
                                                                    {mod.replace(/-/g, " ")}
                                                                </span>
                                                                {SCOPE_ACTIONS.map((action) => {
                                                                    const scope = `${mod}:${action}`;
                                                                    return (
                                                                        <div key={scope} className="flex justify-center">
                                                                            <Checkbox
                                                                                checked={selectedScopes.includes(scope)}
                                                                                onCheckedChange={() => toggleScope(scope)}
                                                                            />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <Separator />

                            {/* ── Advanced Settings ── */}
                            <section>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                >
                                    {showAdvanced ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                    <Settings2 className="h-3.5 w-3.5" />
                                    Advanced Settings
                                </button>

                                {showAdvanced && (
                                    <div className="mt-4 space-y-5">
                                        {/* IP Whitelist */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">{t("ipWhitelist")}</Label>
                                            <p className="text-[11px] text-muted-foreground">
                                                {t("ipWhitelistDesc")}
                                            </p>
                                            <Input
                                                placeholder={t("ipWhitelistPlaceholder")}
                                                value={ipWhitelist}
                                                onChange={(e) => setIpWhitelist(e.target.value)}
                                            />
                                        </div>


                                    </div>
                                )}
                            </section>
                        </div>
                    </form>
                </div>

                {/* ── Sticky Footer ── */}
                <div className="flex items-center justify-end gap-3 border-t px-6 py-4 shrink-0 bg-background">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleClose(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="create-app-form"
                        disabled={submitting}
                    >
                        {submitting && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {submitting ? t("saving") : t("save")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
