"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  AlertTriangle,
  Camera,
  ImageIcon,
  Calendar,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { jsonFetcher } from "@/lib/fetcher";
import { invalidateOrgSettingsCache } from "@/lib/hooks/use-org-settings";
import { updateOrganizationSchema, type UpdateOrganizationInput } from "@/lib/validations/settings";

interface OrganizationResponse {
  organization: UpdateOrganizationInput & { logo?: string | null };
  role: string;
}

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export default function OrganizationSettingsPage() {
  const tc = useTranslations("common");
  const to = useTranslations("settings.organization");
  const ta = useTranslations("settings.address");
  const { update: updateSession } = useSession();
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<UpdateOrganizationInput | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Regional settings state
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [defaultCurrency, setDefaultCurrency] = useState("AED");
  const [savingRegional, setSavingRegional] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      country: "AE",
    },
  });

  const watchedEmirate = watch("emirate");

  const { data: orgData, isLoading: loading, mutate } = useSWR<OrganizationResponse>("/api/organization", jsonFetcher, {
    revalidateOnFocus: false,
    onError() {
      toast.error(to("failedToLoad"));
    },
  });

  useEffect(() => {
    if (!orgData?.organization) return;
    setOrganization(orgData.organization);
    setIsAdmin(orgData.role === "OWNER" || orgData.role === "ADMIN");
    reset({
      name: orgData.organization.name ?? undefined,
      email: orgData.organization.email ?? undefined,
      phone: orgData.organization.phone ?? undefined,
      website: orgData.organization.website ?? undefined,
      trn: orgData.organization.trn ?? undefined,
      tradeLicense: orgData.organization.tradeLicense ?? undefined,
      emirate: orgData.organization.emirate ?? undefined,
      addressLine1: orgData.organization.addressLine1 ?? undefined,
      country: orgData.organization.country || "AE",
    });
    setLogoPreview(orgData.organization.logo ?? null);
    setDefaultCurrency((orgData.organization as Record<string, unknown>).defaultCurrency as string ?? "AED");
    const settings = (orgData.organization as Record<string, unknown>).settings as Record<string, unknown> | undefined;
    if (settings?.dateFormat) setDateFormat(settings.dateFormat as string);
  }, [orgData, reset]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(to("logoSizeError"));
      return;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error(to("logoTypeError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      setLogoChanged(true);
      setLogoFile(file);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: UpdateOrganizationInput) => {
    setSaving(true);
    try {
      let logoUrl: string | null | undefined;

      if (logoChanged && logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);

        const uploadRes = await fetch("/api/uploads/logo", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload logo");
        }

        logoUrl = uploadData.url;
      }

      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(logoChanged ? { logo: logoUrl ?? logoPreview } : {}),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update organization");
      }

      const updated = await res.json();
      setOrganization(updated);
      toast.success(to("saved"));
      setLogoChanged(false);
      setLogoFile(null);
      reset(data); // Reset form state
      invalidateOrgSettingsCache();
      // Refresh session so org name/logo update across the UI immediately
      await updateSession({});
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : to("failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {to("noOrganization")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {to("noPermission")}
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>{to("details")}</CardTitle>
          </div>
          <CardDescription>
            {to("detailsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
            disabled={!isAdmin}
          />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Logo Section */}
            <div className="flex items-center gap-6">
              <div
                role="button"
                tabIndex={isAdmin ? 0 : -1}
                className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-primary/50"
                onClick={() => isAdmin && fileInputRef.current?.click()}
                onKeyDown={(e) => { if (isAdmin && (e.key === "Enter" || e.key === " ")) fileInputRef.current?.click(); }}
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Organization logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
                {isAdmin && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100 rounded-lg">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium">{to("logo")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {to("logoHint")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {to("logoFileHint")}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{to("name")}</Label>
                <Input
                  id="name"
                  placeholder="Your Company LLC"
                  disabled={!isAdmin}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{to("businessEmail")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-9"
                    placeholder="info@company.ae"
                    disabled={!isAdmin}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{to("businessPhone")}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    className="pl-9"
                    placeholder="+971 4 123 4567"
                    disabled={!isAdmin}
                    {...register("phone")}
                  />
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">{to("website")}</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    type="url"
                    className="pl-9"
                    placeholder="https://company.ae"
                    disabled={!isAdmin}
                    {...register("website")}
                  />
                </div>
                {errors.website && (
                  <p className="text-sm text-destructive">{errors.website.message}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* UAE Compliance Information */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-medium">
                <FileText className="h-5 w-5" />
                {to("uaeCompliance")}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trn">
                    {to("trn")}
                    <Badge variant="outline" className="ml-2">
                      {to("requiredForVat")}
                    </Badge>
                  </Label>
                  <Input
                    id="trn"
                    placeholder="100000000000000"
                    disabled={!isAdmin}
                    {...register("trn")}
                  />
                  {errors.trn && (
                    <p className="text-sm text-destructive">{errors.trn.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {to("trnHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tradeLicense">{to("tradeLicense")}</Label>
                  <Input
                    id="tradeLicense"
                    placeholder="Enter trade license number"
                    disabled={!isAdmin}
                    {...register("tradeLicense")}
                  />
                  {errors.tradeLicense && (
                    <p className="text-sm text-destructive">
                      {errors.tradeLicense.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Address Information */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-medium">
                <MapPin className="h-5 w-5" />
                {ta("title")}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emirate">{ta("emirate")}</Label>
                  <Select
                    value={watchedEmirate || ""}
                    onValueChange={(value) => setValue("emirate", value, { shouldDirty: true })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ta("selectEmirate")} />
                    </SelectTrigger>
                    <SelectContent>
                      {UAE_EMIRATES.map((emirate) => (
                        <SelectItem key={emirate} value={emirate}>
                          {emirate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.emirate && (
                    <p className="text-sm text-destructive">{errors.emirate.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="addressLine1">{ta("fullAddress")}</Label>
                  <Textarea
                    id="addressLine1"
                    placeholder="Building name, Street, Area, City"
                    rows={3}
                    disabled={!isAdmin}
                    {...register("addressLine1")}
                  />
                  {errors.addressLine1 && (
                    <p className="text-sm text-destructive">{errors.addressLine1.message}</p>
                  )}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset()}
                  disabled={(!isDirty && !logoChanged) || saving}
                >
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={(!isDirty && !logoChanged) || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {to("saving")}
                    </>
                  ) : (
                    tc("save")
                  )}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* VAT Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>{to("vatStatus")}</CardTitle>
          <CardDescription>
            {to("vatStatusDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{to("vatRegistration")}</p>
                {organization.trn ? (
                  <Badge variant="default" className="bg-green-600">
                    {to("registered")}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{to("notRegistered")}</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {organization.trn
                  ? `TRN: ${organization.trn}`
                  : to("addTrnHint")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regional Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>{to("regionalSettings")}</CardTitle>
          </div>
          <CardDescription>
            {to("regionalSettingsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">
                <DollarSign className="inline h-4 w-4 mr-1" />
                {to("defaultCurrency")}
              </Label>
              <Select
                value={defaultCurrency}
                onValueChange={setDefaultCurrency}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder={to("selectCurrency")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                  <SelectItem value="OMR">OMR — Omani Rial</SelectItem>
                  <SelectItem value="QAR">QAR — Qatari Riyal</SelectItem>
                  <SelectItem value="KWD">KWD — Kuwaiti Dinar</SelectItem>
                  <SelectItem value="BHD">BHD — Bahraini Dinar</SelectItem>
                  <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                  <SelectItem value="PKR">PKR — Pakistani Rupee</SelectItem>
                  <SelectItem value="EGP">EGP — Egyptian Pound</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {to("currencyHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat">
                <Calendar className="inline h-4 w-4 mr-1" />
                {to("dateFormat")}
              </Label>
              <Select
                value={dateFormat}
                onValueChange={setDateFormat}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder={to("selectFormat")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY — 16/04/2026</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY — 04/16/2026</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD — 2026-04-16</SelectItem>
                  <SelectItem value="DD-MM-YYYY">DD-MM-YYYY — 16-04-2026</SelectItem>
                  <SelectItem value="DD MMM YYYY">DD MMM YYYY — 16 Apr 2026</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {to("dateFormatHint")}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <Button
                disabled={savingRegional}
                onClick={async () => {
                  setSavingRegional(true);
                  try {
                    const res = await fetch("/api/organization", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ defaultCurrency, dateFormat }),
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      throw new Error(err.error || "Failed to save");
                    }
                    toast.success(to("savedRegional"));
                    invalidateOrgSettingsCache();
                    await mutate();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : to("failedToSave"));
                  } finally {
                    setSavingRegional(false);
                  }
                }}
              >
                {savingRegional ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {to("saving")}
                  </>
                ) : (
                  tc("save")
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
