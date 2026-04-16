"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Bell, Mail, Smartphone, FileText, CreditCard, Clock, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
import { Switch } from "@/components/ui/switch";
import { jsonFetcher } from "@/lib/fetcher";

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  invoiceNotifications: boolean;
  paymentNotifications: boolean;
  reminderNotifications: boolean;
  marketingNotifications: boolean;
}

export default function NotificationSettingsPage() {
  const t = useTranslations("settings.notifications");
  const [saving, setSaving] = useState(false);
  const defaultPreferences: NotificationPreferences = {
    emailNotifications: true,
    pushNotifications: true,
    invoiceNotifications: true,
    paymentNotifications: true,
    reminderNotifications: true,
    marketingNotifications: false,
  };
  const { data: preferences = defaultPreferences, isLoading: loading, mutate } = useSWR<NotificationPreferences>(
    "/api/user/notifications/preferences",
    async (url: string) => {
      const data = await jsonFetcher<Partial<NotificationPreferences>>(url);

      return {
        emailNotifications: data.emailNotifications ?? true,
        pushNotifications: data.pushNotifications ?? true,
        invoiceNotifications: data.invoiceNotifications ?? true,
        paymentNotifications: data.paymentNotifications ?? true,
        reminderNotifications: data.reminderNotifications ?? true,
        marketingNotifications: data.marketingNotifications ?? false,
      };
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onError() {
        toast.error(t("failedToLoad"));
      },
    }
  );

  const handleToggle = async (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    // Optimistic update
    const nextPreferences = { ...preferences, [key]: value };
    await mutate(nextPreferences, { revalidate: false });
    setSaving(true);

    try {
      const res = await fetch("/api/user/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (!res.ok) {
        // Revert on error
        await mutate(preferences, { revalidate: false });
        throw new Error("Failed to update preference");
      }

      toast.success(t("preferenceUpdated"));
    } catch {
      toast.error(t("failedToUpdate"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2].map((i) => (
              <div key={`skel-${i}`} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>{t("channels")}</CardTitle>
          </div>
          <CardDescription>
            {t("channelsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Label htmlFor="email-notifications" className="font-medium">
                  {t("emailNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailNotificationsDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences.emailNotifications}
              onCheckedChange={(checked) =>
                handleToggle("emailNotifications", checked)
              }
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <Label htmlFor="push-notifications" className="font-medium">
                  {t("pushNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("pushNotificationsDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="push-notifications"
              checked={preferences.pushNotifications}
              onCheckedChange={(checked) =>
                handleToggle("pushNotifications", checked)
              }
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>{t("types")}</CardTitle>
          <CardDescription>
            {t("typesDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <Label htmlFor="invoice-notifications" className="font-medium">
                  {t("invoiceNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("invoiceNotificationsDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="invoice-notifications"
              checked={preferences.invoiceNotifications}
              onCheckedChange={(checked) =>
                handleToggle("invoiceNotifications", checked)
              }
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900">
                <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <Label htmlFor="payment-notifications" className="font-medium">
                  {t("paymentNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("paymentNotificationsDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="payment-notifications"
              checked={preferences.paymentNotifications}
              onCheckedChange={(checked) =>
                handleToggle("paymentNotifications", checked)
              }
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <Label htmlFor="reminder-notifications" className="font-medium">
                  {t("reminderNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("reminderNotificationsDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="reminder-notifications"
              checked={preferences.reminderNotifications}
              onCheckedChange={(checked) =>
                handleToggle("reminderNotifications", checked)
              }
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-pink-100 p-2 dark:bg-pink-900">
                <Megaphone className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <Label htmlFor="marketing-notifications" className="font-medium">
                  {t("marketingNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("marketingNotificationsDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="marketing-notifications"
              checked={preferences.marketingNotifications}
              onCheckedChange={(checked) =>
                handleToggle("marketingNotifications", checked)
              }
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Status */}
      {saving && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("savingChanges")}</span>
        </div>
      )}
    </div>
  );
}
