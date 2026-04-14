"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
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
import { updateOrganizationSchema, type UpdateOrganizationInput } from "@/lib/validations/settings";

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
  const { update: updateSession } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<UpdateOrganizationInput | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const res = await fetch("/api/organization");
        if (!res.ok) throw new Error("Failed to fetch organization");
        const data = await res.json();

        setOrganization(data.organization);
        setIsAdmin(data.role === "OWNER" || data.role === "ADMIN");

        if (data.organization) {
          reset({
            name: data.organization.name ?? undefined,
            email: data.organization.email ?? undefined,
            phone: data.organization.phone ?? undefined,
            website: data.organization.website ?? undefined,
            trn: data.organization.trn ?? undefined,
            tradeLicense: data.organization.tradeLicense ?? undefined,
            emirate: data.organization.emirate ?? undefined,
            addressLine1: data.organization.addressLine1 ?? undefined,
            country: data.organization.country || "AE",
          });
          setLogoPreview(data.organization.logo ?? null);
        }
      } catch {
        toast.error("Failed to load organization details");
      } finally {
        setLoading(false);
      }
    };
    fetchOrganization();
  }, [reset]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be smaller than 2MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("Only JPG, PNG, GIF, WebP or SVG images are allowed");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      setLogoChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: UpdateOrganizationInput) => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(logoChanged ? { logo: logoPreview } : {}),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update organization");
      }

      const updated = await res.json();
      setOrganization(updated);
      toast.success("Organization updated successfully");
      setLogoChanged(false);
      reset(data); // Reset form state
      // Refresh session so org name/logo update across the UI immediately
      await updateSession({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update organization");
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
            You are not associated with any organization. Please contact support.
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
            You don&apos;t have permission to edit organization settings. Contact your organization admin.
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Organization Details</CardTitle>
          </div>
          <CardDescription>
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
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
                className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-primary/50"
                onClick={() => isAdmin && fileInputRef.current?.click()}
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
                <p className="font-medium">Organization Logo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Appears on invoices, quotes, and documents
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, WebP or SVG. Max 2MB.
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
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
                <Label htmlFor="email">Business Email</Label>
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
                <Label htmlFor="phone">Business Phone</Label>
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
                <Label htmlFor="website">Website</Label>
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
                UAE Compliance Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trn">
                    Tax Registration Number (TRN)
                    <Badge variant="outline" className="ml-2">
                      Required for VAT
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
                    15-digit TRN issued by FTA
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tradeLicense">Trade License Number</Label>
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
                Business Address
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emirate">Emirate</Label>
                  <Select
                    value={watchedEmirate || ""}
                    onValueChange={(value) => setValue("emirate", value, { shouldDirty: true })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select emirate" />
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
                  <Label htmlFor="addressLine1">Full Address</Label>
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
                  Cancel
                </Button>
                <Button type="submit" disabled={(!isDirty && !logoChanged) || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
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
          <CardTitle>VAT Status</CardTitle>
          <CardDescription>
            Your organization&apos;s VAT registration status with FTA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">VAT Registration</p>
                {organization.trn ? (
                  <Badge variant="default" className="bg-green-600">
                    Registered
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Registered</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {organization.trn
                  ? `TRN: ${organization.trn}`
                  : "Add your TRN to enable VAT invoicing"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
