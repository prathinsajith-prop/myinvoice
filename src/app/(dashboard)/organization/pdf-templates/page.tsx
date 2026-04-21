"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { CheckCircle2, FileText, Loader2, AlertCircle } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { jsonFetcher } from "@/lib/fetcher";

type PdfTemplate = "CLASSIC" | "MODERN" | "MINIMAL";

interface OrganizationResponse {
    organization: {
        pdfTemplate: PdfTemplate;
    };
    role: string;
}

const TEMPLATES: Array<{
    value: PdfTemplate;
    labelKey: "classic" | "modern" | "minimal";
    descKey: "classicDesc" | "modernDesc" | "minimalDesc";
}> = [
        { value: "CLASSIC", labelKey: "classic", descKey: "classicDesc" },
        { value: "MODERN", labelKey: "modern", descKey: "modernDesc" },
        { value: "MINIMAL", labelKey: "minimal", descKey: "minimalDesc" },
    ];

// Template preview SVG components
function ClassicPreview() {
    return (
        <svg viewBox="0 0 210 297" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Header bar */}
            <rect width="210" height="30" fill="#3b82f6" />
            <text x="10" y="20" fill="white" fontSize="8" fontWeight="bold">INVOICE</text>

            {/* Content area */}
            <rect x="10" y="40" width="190" height="12" fill="#f3f4f6" />
            <rect x="10" y="55" width="190" height="12" fill="white" />
            <rect x="10" y="70" width="190" height="12" fill="#f3f4f6" />
            <rect x="10" y="85" width="190" height="12" fill="white" />

            {/* Totals box */}
            <rect x="130" y="110" width="70" height="35" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
            <text x="135" y="125" fontSize="6">Total</text>
            <text x="135" y="135" fontSize="8" fontWeight="bold">$1,234.56</text>
        </svg>
    );
}

function ModernPreview() {
    return (
        <svg viewBox="0 0 210 297" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Accent strip */}
            <rect width="210" height="5" fill="#3b82f6" />

            {/* Header */}
            <text x="10" y="25" fontSize="10" fontWeight="bold">INVOICE</text>

            {/* Side by side sections */}
            <rect x="10" y="35" width="90" height="40" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.5" />
            <rect x="110" y="35" width="90" height="40" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.5" />

            {/* Items */}
            <line x1="10" y1="85" x2="200" y2="85" stroke="#e5e7eb" strokeWidth="0.5" />
            <line x1="10" y1="100" x2="200" y2="100" stroke="#e5e7eb" strokeWidth="0.5" />
            <line x1="10" y1="115" x2="200" y2="115" stroke="#e5e7eb" strokeWidth="0.5" />

            {/* Totals with accent border */}
            <rect x="130" y="130" width="70" height="30" fill="white" stroke="#3b82f6" strokeWidth="2" />
            <text x="135" y="148" fontSize="7" fontWeight="bold">Total: $1,234.56</text>
        </svg>
    );
}

function MinimalPreview() {
    return (
        <svg viewBox="0 0 210 297" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Clean header */}
            <text x="10" y="20" fontSize="10" fontWeight="bold">INVOICE</text>
            <line x1="10" y1="25" x2="200" y2="25" stroke="#000" strokeWidth="0.3" />

            {/* Minimal info */}
            <text x="10" y="40" fontSize="6">Date: 01/01/2024</text>
            <text x="10" y="48" fontSize="6">Invoice #: INV-001</text>

            {/* Simple lines for items */}
            <line x1="10" y1="65" x2="200" y2="65" stroke="#d1d5db" strokeWidth="0.3" />
            <line x1="10" y1="75" x2="200" y2="75" stroke="#d1d5db" strokeWidth="0.3" />
            <line x1="10" y1="85" x2="200" y2="85" stroke="#d1d5db" strokeWidth="0.3" />
            <line x1="10" y1="95" x2="200" y2="95" stroke="#d1d5db" strokeWidth="0.3" />

            {/* Right-aligned total */}
            <line x1="10" y1="110" x2="200" y2="110" stroke="#000" strokeWidth="0.3" />
            <text x="200" y="125" textAnchor="end" fontSize="8" fontWeight="bold">Total: $1,234.56</text>
        </svg>
    );
}

const TEMPLATE_PREVIEWS: Record<PdfTemplate, () => React.ReactElement> = {
    CLASSIC: ClassicPreview,
    MODERN: ModernPreview,
    MINIMAL: MinimalPreview,
};

export default function PdfTemplatesPage() {
    const t = useTranslations("settings.pdfTemplates");
    const [saving, setSaving] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate>("CLASSIC");

    const { data, isLoading, mutate, error } = useSWR<OrganizationResponse>(
        "/api/organization",
        jsonFetcher,
        {
            revalidateOnFocus: false,
            onSuccess: (data) => {
                setSelectedTemplate(data.organization.pdfTemplate);
            },
            onError(err) {
                console.error("Failed to load organization data:", err);
                const errorMessage = err?.response?.data?.error || err?.message || t("failedToLoad");
                toast.error(errorMessage);
            },
        }
    );

    const isAdmin = data?.role === "OWNER" || data?.role === "ADMIN";
    const currentTemplate = data?.organization.pdfTemplate;

    const handleSave = async () => {
        if (!isAdmin) {
            toast.error("You don't have permission to change settings");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/organization", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pdfTemplate: selectedTemplate }),
            });

            if (!res.ok) {
                const errData = await res.json();
                console.error("Save error:", errData);
                const errorMessage = errData.error || errData.message || "Failed to save";
                if (res.status === 403) {
                    throw new Error("You don't have permission to change PDF templates. Only Admins and Owners can modify this setting.");
                }
                throw new Error(errorMessage);
            }

            await mutate();
            toast.success(t("saved"));
        } catch (err) {
            console.error("Failed to save template:", err);
            toast.error(t("failedToSave"));
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-5 w-full max-w-2xl" />
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={`skeleton-${i}`} className="h-96" />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        {error?.response?.data?.error || "Failed to load PDF templates. You may not have permission to access this page."}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const hasChanges = selectedTemplate !== currentTemplate;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl">{t("description")}</p>
            </div>

            {!isAdmin && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        You need Owner or Admin role to change PDF templates.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                {TEMPLATES.map((template) => {
                    const isSelected = selectedTemplate === template.value;
                    const isCurrent = currentTemplate === template.value;
                    const PreviewComponent = TEMPLATE_PREVIEWS[template.value];

                    return (
                        <Card
                            key={template.value}
                            className={`relative transition-all ${isSelected
                                ? "ring-2 ring-primary shadow-lg"
                                : "hover:shadow-md"
                                } ${!isAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                                }`}
                            onClick={() => isAdmin && setSelectedTemplate(template.value)}
                        >
                            {isSelected && (
                                <div className="absolute -top-3 -right-3 z-10">
                                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                        <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
                                    </div>
                                </div>
                            )}

                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between mb-2">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        {t(template.labelKey)}
                                    </CardTitle>
                                    {isCurrent && (
                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                            Active
                                        </span>
                                    )}
                                </div>
                                <CardDescription className="text-sm min-h-[40px]">
                                    {t(template.descKey)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="aspect-[210/297] bg-white rounded-lg border-2 border-gray-200 p-2 shadow-inner overflow-hidden">
                                    <PreviewComponent />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {hasChanges && (
                <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border">
                    <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span>You have unsaved changes. Click Save to apply the new template.</span>
                    </div>
                    <Button onClick={handleSave} disabled={saving || !isAdmin} size="lg">
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Save Template
                            </>
                        )}
                    </Button>
                </div>
            )}

            {!hasChanges && currentTemplate && (
                <div className="text-center text-sm text-muted-foreground py-4">
                    Currently using <strong>{currentTemplate.toLowerCase()}</strong> template for all PDF documents
                </div>
            )}
        </div>
    );
}
