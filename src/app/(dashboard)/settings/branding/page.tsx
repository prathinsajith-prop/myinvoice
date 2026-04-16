"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
    Loader2,
    Palette,
    ImageIcon,
    Camera,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { jsonFetcher } from "@/lib/fetcher";

interface BrandingData {
    logo: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    name: string;
}

interface BrandingResponse {
    organization: BrandingData;
    role: string;
}

const DEFAULT_PRIMARY = "#3B82F6";
const DEFAULT_SECONDARY = "#10B981";

export default function BrandingSettingsPage() {
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
    const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
    const [orgName, setOrgName] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, isLoading: loading, mutate } = useSWR<BrandingResponse>("/api/organization", jsonFetcher, {
        revalidateOnFocus: false,
        onError() {
            toast.error("Failed to load branding settings");
        },
    });

    useEffect(() => {
        if (!data) return;
        const org = data.organization;
        setOrgName(org.name ?? "");
        setPrimaryColor(org.primaryColor ?? DEFAULT_PRIMARY);
        setSecondaryColor(org.secondaryColor ?? DEFAULT_SECONDARY);
        setLogoPreview(org.logo ?? null);
        setIsAdmin(data.role === "OWNER" || data.role === "ADMIN");
    }, [data]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Logo must be smaller than 2 MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setLogoPreview(result);
            setLogoFile(file);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                primaryColor,
                secondaryColor,
            };

            if (logoFile) {
                const formData = new FormData();
                formData.append("file", logoFile);

                const uploadRes = await fetch("/api/uploads/logo", {
                    method: "POST",
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) {
                    throw new Error(uploadData.error ?? "Failed to upload logo");
                }
                payload.logo = uploadData.url;
            }

            const res = await fetch("/api/organization", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "Failed to save branding");
            }

            toast.success("Branding saved successfully");
            setLogoFile(null);
            await mutate();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save branding");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Logo */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <CardTitle>Organization Logo</CardTitle>
                    </div>
                    <CardDescription>
                        Upload your logo to appear on invoices, quotes, and other documents
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-6">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
                            {logoPreview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={logoPreview}
                                    alt="Organization logo"
                                    className="h-full w-full object-contain p-1"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <span className="text-2xl font-bold text-muted-foreground">
                                        {orgName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100 rounded-lg"
                                >
                                    <Camera className="h-6 w-6 text-white" />
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                {logoPreview ? "Current logo" : "No logo uploaded"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                PNG, JPG, or SVG. Max 2 MB. Recommended: 200×200 px or larger.
                            </p>
                            {isAdmin && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Camera className="mr-2 h-4 w-4" />
                                    {logoPreview ? "Change Logo" : "Upload Logo"}
                                </Button>
                            )}
                        </div>
                    </div>
                    <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoChange}
                        disabled={!isAdmin}
                    />
                </CardContent>
            </Card>

            {/* Colors */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        <CardTitle>Brand Colors</CardTitle>
                    </div>
                    <CardDescription>
                        Choose colors used on your PDF documents and invoices
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                        {/* Primary color */}
                        <div className="space-y-2">
                            <Label htmlFor="primaryColor">Primary Color</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    id="primaryColor"
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    disabled={!isAdmin}
                                    className="h-10 w-14 cursor-pointer rounded border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <Input
                                    value={primaryColor}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setPrimaryColor(v);
                                    }}
                                    disabled={!isAdmin}
                                    maxLength={7}
                                    className="font-mono w-32"
                                />
                                <div
                                    className="h-10 w-10 rounded border"
                                    style={{ backgroundColor: primaryColor }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Used for headings, table headers, and accents
                            </p>
                        </div>

                        {/* Secondary color */}
                        <div className="space-y-2">
                            <Label htmlFor="secondaryColor">Secondary Color</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    id="secondaryColor"
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    disabled={!isAdmin}
                                    className="h-10 w-14 cursor-pointer rounded border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <Input
                                    value={secondaryColor}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setSecondaryColor(v);
                                    }}
                                    disabled={!isAdmin}
                                    maxLength={7}
                                    className="font-mono w-32"
                                />
                                <div
                                    className="h-10 w-10 rounded border"
                                    style={{ backgroundColor: secondaryColor }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Used for subtotals, badges, and secondary elements
                            </p>
                        </div>
                    </div>

                    <Separator />

                    {/* Preview strip */}
                    <div>
                        <p className="mb-3 text-sm font-medium">Preview</p>
                        <div
                            className="rounded-lg p-4 text-white"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <p className="font-bold">INVOICE #INV-0001</p>
                            <p className="text-sm opacity-80">{orgName || "Your Company"}</p>
                            <div className="mt-3 flex gap-2">
                                <span
                                    className="rounded px-2 py-0.5 text-xs font-medium text-white"
                                    style={{ backgroundColor: secondaryColor }}
                                >
                                    Paid
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            {isAdmin && (
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            "Save Branding"
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
