"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Camera, User } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { jsonFetcher } from "@/lib/fetcher";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/settings";

interface ProfileResponse {
  name: string | null;
  phone: string | null;
  image: string | null;
}

export default function ProfileSettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
  });

  const { data: profileData, isLoading: loading, mutate } = useSWR<ProfileResponse>("/api/user/profile", jsonFetcher, {
    revalidateOnFocus: false,
    onError() {
      toast.error("Failed to load profile");
    },
  });

  useEffect(() => {
    if (!profileData) return;
    reset({
      name: profileData.name ?? undefined,
      phone: profileData.phone ?? undefined,
    });
    setImagePreview(profileData.image ?? null);
  }, [profileData, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG, GIF or WebP images are allowed");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setImageChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: UpdateProfileInput) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(imageChanged ? { image: imagePreview } : {}),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const updatedUser = await res.json();

      // Trigger session refresh — session callback re-reads name & image from DB
      await updateSession();

      toast.success("Profile updated successfully");
      setImageChanged(false);
      // Update local preview to match what was saved
      setImagePreview(updatedUser.image ?? null);
      reset({ name: data.name, phone: data.phone });
      await mutate(updatedUser, { revalidate: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and profile picture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar Section */}
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleImageChange}
            />
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={imagePreview || undefined}
                    alt={session?.user?.name || "User"}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {initials || <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <h3 className="font-medium">{session?.user?.name || "User"}</h3>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click the camera icon to upload. JPG, PNG, GIF or WebP. Max 2MB.
                </p>
              </div>
            </div>

            <Separator />

            {/* Form Fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={session?.user?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+971 50 123 4567"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => reset()}
                disabled={(!isDirty && !imageChanged) || saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={(!isDirty && !imageChanged) || saving}>
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
          </form>
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Your account details and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Account Created
              </p>
              <p className="text-sm">
                {session?.user ? "Recently" : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Email Verified
              </p>
              <p className="text-sm">
                {session?.user ? "Verified" : "Not verified"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
