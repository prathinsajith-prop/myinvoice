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
      toast.error("Failed to load more history");
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
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
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

      toast.success("Password updated successfully");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
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
      toast.success("Scan the QR and verify with your 6-digit code");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to initialize 2FA");
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
      toast.success("Two-factor authentication enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enable 2FA");
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
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disable 2FA");
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
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter your current password"
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
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter your new password"
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
                    Password strength: {strengthLabels[passwordStrength - 1] || "Very Weak"}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
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
                    Updating...
                  </>
                ) : (
                  "Update Password"
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
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            {twoFactorLoading ? (
              <Badge variant="secondary">Loading</Badge>
            ) : twoFactorEnabled ? (
              <Badge variant="default">Enabled</Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security to your account
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
                  <p className="font-medium">Authenticator App</p>
                  <p className="text-sm text-muted-foreground">
                    Use Google Authenticator, Microsoft Authenticator, or Authy
                  </p>
                </div>
              </div>
              {!twoFactorEnabled ? (
                <Button variant="outline" onClick={handleStartTwoFactor} disabled={twoFactorSaving}>
                  {twoFactorSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enable
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleDisableTwoFactor} disabled={twoFactorSaving || totpCode.length !== 6}>
                  {twoFactorSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Disable
                </Button>
              )}
            </div>

            {totpQr && !twoFactorEnabled && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium">1) Scan QR code in your authenticator app</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={totpQr} alt="2FA QR code" className="h-48 w-48 rounded border bg-white p-2" />
                {totpSecret && (
                  <p className="text-xs text-muted-foreground break-all">Manual key: {totpSecret}</p>
                )}
                <p className="text-sm font-medium">2) Enter the 6-digit code to confirm</p>
                <div className="flex gap-2">
                  <Input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                  />
                  <Button onClick={handleVerifyTwoFactor} disabled={twoFactorSaving || totpCode.length !== 6}>
                    Verify
                  </Button>
                </div>
              </div>
            )}

            {twoFactorEnabled && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Enter your current authenticator code to disable 2FA.
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
            <CardTitle>Login History</CardTitle>
          </div>
          <CardDescription>
            Recent sign-in activity for your account
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
            <p className="text-sm text-muted-foreground">No login history yet.</p>
          ) : (
            <div className="space-y-3">
              {loginHistory.map((record) => {
                const when = new Date(record.createdAt);
                const deviceLabel = [record.browser, record.os]
                  .filter(Boolean)
                  .join(" · ") || record.device || "Unknown device";
                const location = [record.city, record.country]
                  .filter(Boolean)
                  .join(", ") || record.ipAddress || "Unknown location";

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
                              Failed
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
                        Loading…
                      </>
                    ) : (
                      "Load More"
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
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive" disabled>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
