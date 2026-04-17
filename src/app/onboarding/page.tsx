"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
    Building2,
    Globe,
    Clock,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Search,
    Check,
    FileText,
} from "lucide-react";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
    getCountryOptions,
    getTimezonesForCountry,
    getAllTimezones,
    formatTimezone,
    UAE_EMIRATES,
    BUSINESS_TYPES,
    type CountryOption,
} from "@/lib/utils/countries";

// ── Schema ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
    name: z.string().min(2, "Organization name must be at least 2 characters").max(200),
    legalName: z.string().min(2).max(200).optional().or(z.literal("")),
    businessType: z.string().optional(),
});

const step2Schema = z.object({
    country: z.string().min(2, "Please select a country"),
    timezone: z.string().min(1, "Please select a timezone"),
    defaultCurrency: z.string().min(1, "Please select a currency"),
});

const step3Schema = z.object({
    phone: z.string().optional().or(z.literal("")),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    addressLine1: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    emirate: z.string().optional(),
    trn: z
        .string()
        .length(15, "TRN must be exactly 15 digits")
        .regex(/^\d+$/, "TRN must be numbers only")
        .optional()
        .or(z.literal("")),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FormValues = z.infer<typeof fullSchema>;

// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
    { id: 1, title: "Business Info", description: "Your organization name and type", icon: Building2 },
    { id: 2, title: "Location", description: "Country, timezone & currency", icon: Globe },
    { id: 3, title: "Details", description: "Contact & tax information", icon: FileText },
];

// ── CountrySearch ─────────────────────────────────────────────────────────────

function CountrySearch({
    value,
    onChange,
    countries,
}: {
    value: string;
    onChange: (iso2: string, currency: string) => void;
    countries: CountryOption[];
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    const filtered = useMemo(() => {
        if (!query) return countries.slice(0, 50);
        const q = query.toLowerCase();
        return countries.filter(
            (c) =>
                c.label.toLowerCase().includes(q) ||
                c.value.toLowerCase().includes(q) ||
                c.currency.toLowerCase().includes(q)
        );
    }, [query, countries]);

    const selected = countries.find((c) => c.value === value);

    return (
        <div className="relative">
            <Button
                type="button"
                variant="outline"
                onClick={() => setOpen((o) => !o)}
                className="flex h-10 w-full items-center justify-between px-3 py-2 text-sm"
            >
                {selected ? (
                    <span className="flex items-center gap-2">
                        <span>{selected.flag}</span>
                        <span>{selected.label}</span>
                        <Badge variant="secondary" className="ml-1 text-xs">
                            {selected.currency}
                        </Badge>
                    </span>
                ) : (
                    <span className="text-muted-foreground">Select country…</span>
                )}
                <ChevronRight className="h-4 w-4 opacity-50 rotate-90" />
            </Button>

            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                    {/* Search */}
                    <div className="flex items-center border-b px-3">
                        <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                        <Input
                            placeholder="Search country or currency…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                        />
                    </div>
                    <ul className="max-h-60 overflow-y-auto p-1">
                        {filtered.length === 0 && (
                            <li className="py-6 text-center text-sm text-muted-foreground">
                                No country found
                            </li>
                        )}
                        {filtered.map((c) => (
                            <li key={c.value}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="flex h-auto w-full items-center gap-2 justify-start rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                                    onClick={() => {
                                        onChange(c.value, c.currency);
                                        setOpen(false);
                                        setQuery("");
                                    }}
                                >
                                    <span>{c.flag}</span>
                                    <span className="flex-1 text-left">{c.label}</span>
                                    <Badge variant="outline" className="text-xs">
                                        {c.currency}
                                    </Badge>
                                    {value === c.value && <Check className="h-4 w-4 text-primary" />}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const countries = useMemo(() => getCountryOptions(), []);

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        trigger,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(fullSchema),
        defaultValues: {
            country: "AE",
            defaultCurrency: "AED",
            timezone: "Asia/Dubai",
            businessType: "",
        },
    });

    const watchCountry = watch("country");
    const watchTimezone = watch("timezone");

    // Auto-update timezone + currency when country changes
    useEffect(() => {
        if (!watchCountry) return;
        const countryData = countries.find((c) => c.value === watchCountry);
        if (!countryData) return;
        // Set currency
        setValue("defaultCurrency", countryData.currency);
        // Set first timezone for that country
        const tzs = getTimezonesForCountry(watchCountry);
        if (tzs.length > 0) setValue("timezone", tzs[0]);
    }, [watchCountry, countries, setValue]);

    const timezonesForCountry = useMemo(() => {
        const countryTzs = getTimezonesForCountry(watchCountry);
        if (countryTzs.length > 0) return countryTzs;
        // Fallback: all Intl timezones
        return getAllTimezones();
    }, [watchCountry]);

    const isUAE = watchCountry === "AE";
    const selectedCountry = countries.find((c) => c.value === watchCountry);

    async function validateStep(s: number) {
        if (s === 1) return await trigger(["name"]);
        if (s === 2) return await trigger(["country", "timezone", "defaultCurrency"]);
        return true;
    }

    async function handleNext() {
        const valid = await validateStep(step);
        if (valid) setStep((s) => s + 1);
    }

    async function onSubmit(data: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/organization", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    legalName: data.legalName || undefined,
                    businessType: data.businessType || undefined,
                    country: data.country,
                    timezone: data.timezone,
                    defaultCurrency: data.defaultCurrency,
                    phone: data.phone || undefined,
                    email: data.email || undefined,
                    addressLine1: data.addressLine1 || undefined,
                    city: data.city || undefined,
                    emirate: data.emirate || undefined,
                    trn: data.trn || undefined,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create organization");
            }

            // Refresh session so new org token is picked up
            await fetch("/api/auth/session");
            toast.success("Organization created successfully!");
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="rounded-full bg-primary/10 p-4">
                            <Building2 className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold">Set up your organization</h1>
                    <p className="text-muted-foreground mt-1">
                        This takes about 2 minutes
                    </p>
                </div>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-0 mb-8">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = step === s.id;
                        const isDone = step > s.id;
                        return (
                            <div key={s.id} className="flex items-center">
                                <div className="flex flex-col items-center gap-1">
                                    <div
                                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${isDone
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : isActive
                                                ? "border-primary text-primary"
                                                : "border-muted-foreground/30 text-muted-foreground"
                                            }`}
                                    >
                                        {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                                    </div>
                                    <span
                                        className={`text-xs font-medium hidden sm:block ${isActive ? "text-foreground" : "text-muted-foreground"
                                            }`}
                                    >
                                        {s.title}
                                    </span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div
                                        className={`h-0.5 w-16 sm:w-24 mx-2 transition-colors ${step > s.id ? "bg-primary" : "bg-muted"
                                            }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)}>
                    {/* ── Step 1: Business Info ── */}
                    {step === 1 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-primary" />
                                    Business Information
                                </CardTitle>
                                <CardDescription>
                                    What is your organization called?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Org Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="name">
                                        Organization Name <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Dubai Tech Solutions LLC"
                                        {...register("name")}
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-destructive">{errors.name.message}</p>
                                    )}
                                </div>

                                {/* Legal Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="legalName">
                                        Legal Name{" "}
                                        <span className="text-muted-foreground text-xs">(if different)</span>
                                    </Label>
                                    <Input
                                        id="legalName"
                                        placeholder="e.g. Dubai Tech Solutions LLC — exactly as on trade license"
                                        {...register("legalName")}
                                    />
                                </div>

                                {/* Business Type */}
                                <div className="space-y-2">
                                    <Label>Business Type</Label>
                                    <Controller
                                        name="businessType"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value ?? ""}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {BUSINESS_TYPES.map((t) => (
                                                        <SelectItem key={t.value} value={t.value}>
                                                            {t.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Step 2: Location ── */}
                    {step === 2 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Globe className="h-5 w-5 text-primary" />
                                    Location & Currency
                                </CardTitle>
                                <CardDescription>
                                    Where is your business based?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Country */}
                                <div className="space-y-2">
                                    <Label>
                                        Country <span className="text-destructive">*</span>
                                    </Label>
                                    <Controller
                                        name="country"
                                        control={control}
                                        render={({ field }) => (
                                            <CountrySearch
                                                value={field.value}
                                                countries={countries}
                                                onChange={(iso2, currency) => {
                                                    field.onChange(iso2);
                                                    setValue("defaultCurrency", currency);
                                                }}
                                            />
                                        )}
                                    />
                                    {errors.country && (
                                        <p className="text-sm text-destructive">{errors.country.message}</p>
                                    )}
                                </div>

                                {/* Timezone */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4" />
                                        Timezone <span className="text-destructive">*</span>
                                    </Label>
                                    <Controller
                                        name="timezone"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select timezone…">
                                                        {field.value ? formatTimezone(field.value) : "Select timezone…"}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent className="max-h-72">
                                                    {timezonesForCountry.map((tz) => (
                                                        <SelectItem key={tz} value={tz}>
                                                            {formatTimezone(tz)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.timezone && (
                                        <p className="text-sm text-destructive">{errors.timezone.message}</p>
                                    )}
                                    {watchTimezone && (
                                        <p className="text-xs text-muted-foreground">
                                            Current time:{" "}
                                            {new Intl.DateTimeFormat("en", {
                                                timeZone: watchTimezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: true,
                                                weekday: "short",
                                                month: "short",
                                                day: "numeric",
                                            }).format(new Date())}
                                        </p>
                                    )}
                                </div>

                                {/* Currency */}
                                <div className="space-y-2">
                                    <Label>Default Currency</Label>
                                    <Controller
                                        name="defaultCurrency"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[
                                                        { code: "AED", name: "UAE Dirham" },
                                                        { code: "USD", name: "US Dollar" },
                                                        { code: "EUR", name: "Euro" },
                                                        { code: "GBP", name: "British Pound" },
                                                        { code: "SAR", name: "Saudi Riyal" },
                                                        { code: "OMR", name: "Omani Rial" },
                                                        { code: "QAR", name: "Qatari Riyal" },
                                                        { code: "KWD", name: "Kuwaiti Dinar" },
                                                        { code: "BHD", name: "Bahraini Dinar" },
                                                        { code: "INR", name: "Indian Rupee" },
                                                        { code: "PKR", name: "Pakistani Rupee" },
                                                        { code: "EGP", name: "Egyptian Pound" },
                                                    ].map((c) => (
                                                        <SelectItem key={c.code} value={c.code}>
                                                            {c.code} — {c.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                {selectedCountry && (
                                    <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-3">
                                        <span className="text-2xl">{selectedCountry.flag}</span>
                                        <div className="text-sm">
                                            <p className="font-medium">{selectedCountry.label}</p>
                                            <p className="text-muted-foreground">
                                                {selectedCountry.callingCode} · {selectedCountry.currency}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Step 3: Details ── */}
                    {step === 3 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    Contact & Tax Details
                                </CardTitle>
                                <CardDescription>
                                    Optional — you can fill these in later from Settings.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input
                                            id="phone"
                                            placeholder="+971 50 123 4567"
                                            {...register("phone")}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Business Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="info@company.ae"
                                            {...register("email")}
                                        />
                                        {errors.email && (
                                            <p className="text-sm text-destructive">{errors.email.message}</p>
                                        )}
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="addressLine1">Address</Label>
                                    <Input
                                        id="addressLine1"
                                        placeholder="Business Bay, Tower A, Floor 12"
                                        {...register("addressLine1")}
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="city">City</Label>
                                        <Input id="city" placeholder="Dubai" {...register("city")} />
                                    </div>

                                    {isUAE ? (
                                        <div className="space-y-2">
                                            <Label>Emirate</Label>
                                            <Controller
                                                name="emirate"
                                                control={control}
                                                render={({ field }) => (
                                                    <Select
                                                        value={field.value ?? ""}
                                                        onValueChange={field.onChange}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select emirate…" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {UAE_EMIRATES.map((e) => (
                                                                <SelectItem key={e} value={e}>
                                                                    {e}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                    ) : null}
                                </div>

                                {isUAE && (
                                    <>
                                        <Separator />
                                        <div className="space-y-2">
                                            <Label htmlFor="trn">
                                                TRN{" "}
                                                <span className="text-muted-foreground text-xs">
                                                    (Tax Registration Number — 15 digits)
                                                </span>
                                            </Label>
                                            <Input
                                                id="trn"
                                                placeholder="100123456789003"
                                                maxLength={15}
                                                {...register("trn")}
                                            />
                                            {errors.trn && (
                                                <p className="text-sm text-destructive">{errors.trn.message}</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Navigation */}
                    <div className="mt-6 flex items-center justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep((s) => s - 1)}
                            disabled={step === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Back
                        </Button>

                        {step < STEPS.length ? (
                            <Button type="button" onClick={handleNext}>
                                Continue
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        ) : (
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating…
                                    </>
                                ) : (
                                    <>
                                        Create Organization
                                        <Check className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
