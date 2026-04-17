"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Shield,
  Key,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  History,
  Monitor,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { jsonFetcher } from "@/lib/fetcher";
import { updatePasswordSchema, type UpdatePasswordInput } from "@/lib/validations/settings";

interface LoginHistoryResponse {
  data?: LoginHistoryRecord[];
  nextCursor?: string | null;
}

interface ProfileSecurityResponse {
  twoFactorEnabled?: boolean;
}

interface LoginHistoryRecord {
  id: string;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  country: string | null;
  success: boolean;
  failReason: string | null;
  createdAt: string;
}

export default function SecuritySettingsPage() {
  const t = useTranslations("settings.security");
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: historyData, isLoading: historyLoading } = useSWR<LoginHistoryResponse>(
    "/api/user/login-history",
    jsonFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (!historyData) return;
    setLoginHistory(historyData.data ?? []);
    setNextCursor(historyData.nextCursor ?? null);
  }, [historyData]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/user/login-history?cursor=${encodeURIComponent(nextCursor)}`);
      const json: LoginHistoryResponse = await res.json();
      setLoginHistory((prev) => [...prev, ...(json.data ?? [])]);
      setNextCursor(json.nextCursor ?? null);
    } catch {
      toast.error(t("failedToLoadHistory"));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);
  const { data: profileData, isLoading: twoFactorLoading, mutate: mutateProfile } = useSWR<ProfileSecurityResponse>(
    "/api/user/profile",
    jsonFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  const twoFactorEnabled = Boolean(profileData?.twoFactorEnabled);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const newPassword = watch("newPassword", "");

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthLabels = [t("strengthVeryWeak"), t("strengthWeak"), t("strengthFair"), t("strengthGood"), t("strengthStrong")];
  const strengthColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-blue-500",
    "bg-green-500",
  ];

  const onSubmit = async (data: UpdatePasswordInput) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update password");
      }

      toast.success(t("passwordUpdated"));
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedToUpdatePassword"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartTwoFactor = async () => {
    setTwoFactorSaving(true);
    try {
      const res = await fetch("/api/user/2fa/setup", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to initialize 2FA");

      setTotpSecret(json.secret);
      setTotpQr(json.qrCodeDataUrl);
      toast.success(t("twoFactorSetupPrompt"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedToSetup2FA"));
    } finally {
      setTwoFactorSaving(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    setTwoFactorSaving(true);
    try {
      const res = await fetch("/api/user/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invalid code");

      setTotpCode("");
      setTotpSecret(null);
      setTotpQr(null);
      await mutateProfile();
      toast.success(t("twoFactorEnabled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedToEnable2FA"));
    } finally {
      setTwoFactorSaving(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    setTwoFactorSaving(true);
    try {
      const res = await fetch("/api/user/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invalid code");

      setTotpCode("");
      setTotpSecret(null);
      setTotpQr(null);
      await mutateProfile();
      toast.success(t("twoFactorDisabled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedToDisable2FA"));
    } finally {
      setTwoFactorSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>{t("changePassword")}</CardTitle>
          </div>
          <CardDescription>
            {t("changePasswordDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder={t("currentPasswordPlaceholder")}
                  {...register("currentPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder={t("newPasswordPlaceholder")}
                  {...register("newPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div
                        key={`strength-${index}`}
                        className={`h-1 flex-1 rounded-full transition-colors ${index < passwordStrength
                          ? strengthColors[passwordStrength - 1]
                          : "bg-muted"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("passwordStrength")}: {strengthLabels[passwordStrength - 1] || t("strengthVeryWeak")}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmNewPassword")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("confirmNewPasswordPlaceholder")}
                  {...register("confirmPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("updating")}
                  </>
                ) : (
                  t("updatePassword")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle>{t("twoFactor")}</CardTitle>
            </div>
            {twoFactorLoading ? (
              <Badge variant="secondary">{t("loading")}</Badge>
            ) : twoFactorEnabled ? (
              <Badge variant="default">{t("enabled")}</Badge>
            ) : (
              <Badge variant="outline">{t("disabled")}</Badge>
            )}
          </div>
          <CardDescription>
            {t("twoFactorDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-muted p-3">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{t("authenticatorApp")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("authenticatorAppDesc")}
                  </p>
                </div>
              </div>
              {!twoFactorEnabled ? (
                <Button variant="outline" onClick={handleStartTwoFactor} disabled={twoFactorSaving}>
                  {twoFactorSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("enable")}
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleDisableTwoFactor} disabled={twoFactorSaving || totpCode.length !== 6}>
                  {twoFactorSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("disable")}
                </Button>
              )}
            </div>

            {totpQr && !twoFactorEnabled && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium">{t("scanQrStep")}</p>
                { }
                <img src={totpQr} alt="2FA QR code" className="h-48 w-48 rounded border bg-white p-2" />
                {totpSecret && (
                  <p className="text-xs text-muted-foreground break-all">Manual key: {totpSecret}</p>
                )}
                <p className="text-sm font-medium">{t("enterCodeStep")}</p>
                <div className="flex gap-2">
                  <Input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                  />
                  <Button onClick={handleVerifyTwoFactor} disabled={twoFactorSaving || totpCode.length !== 6}>
                    {t("verify")}
                  </Button>
                </div>
              </div>
            )}

            {twoFactorEnabled && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("disableCodePrompt")}
                </p>
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Login History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle>{t("loginHistory")}</CardTitle>
          </div>
          <CardDescription>
            {t("loginHistoryDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : loginHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLoginHistory")}</p>
          ) : (
            <div className="space-y-3">
              {loginHistory.map((record) => {
                const when = new Date(record.createdAt);
                const deviceLabel = [record.browser, record.os]
                  .filter(Boolean)
                  .join(" · ") || record.device || t("unknownDevice");
                const location = [record.city, record.country]
                  .filter(Boolean)
                  .join(", ") || record.ipAddress || t("unknownLocation");

                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`rounded-full p-2 ${record.success
                          ? "bg-green-100 dark:bg-green-900"
                          : "bg-red-100 dark:bg-red-900"
                          }`}
                      >
                        {record.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-medium">{deviceLabel}</p>
                          {!record.success && (
                            <Badge variant="destructive" className="text-xs">
                              {t("failed")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{location}</p>
                        {record.failReason && (
                          <p className="text-xs text-destructive">{record.failReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {when.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        {when.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {nextCursor && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("loadingMore")}
                      </>
                    ) : (
                      t("loadMore")
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">{t("dangerZone")}</CardTitle>
          <CardDescription>
            {t("dangerZoneDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("deleteAccount")}</p>
              <p className="text-sm text-muted-foreground">
                {t("deleteAccountDesc")}
              </p>
            </div>
            <Button variant="destructive" disabled>
              {t("deleteAccount")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
