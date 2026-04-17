"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { useAuthStore } from "@/lib/stores/auth-store";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [hasAuthenticatorApp, setHasAuthenticatorApp] = useState(false);

  const { isSigningIn, setSigningIn, setAuthError, clearAuthError } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setSigningIn(true);
    clearAuthError();
    try {
      if (step === "credentials") {
        const response = await fetch("/api/auth/login-challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.email, password: data.password }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload.error || "Invalid email or password";
          setAuthError(message);
          toast.error(message);
          return;
        }

        setPendingEmail(data.email);
        setPendingPassword(data.password);
        setExpiresInMinutes(payload.expiresInMinutes ?? 10);
        setHasAuthenticatorApp(Boolean(payload.hasAuthenticatorApp));
        setStep("code");
        toast.success("Authentication code sent. Check your email to continue.");
      } else {
        const result = await signIn("credentials", {
          email: pendingEmail,
          password: pendingPassword,
          otp: data.otp,
          redirect: false,
        });

        if (result?.error) {
          setAuthError("Invalid or expired authentication code");
          toast.error("Invalid or expired authentication code");
          return;
        }

        window.location.href = callbackUrl;
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      toast.error("An error occurred. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {step === "credentials" ? "Welcome back" : "Enter your authentication code"}
        </h1>
        <p className="text-muted-foreground">
          {step === "credentials"
            ? "Sign in to your account to continue"
            : `We sent a 6-digit code to ${pendingEmail}.`}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {step === "credentials" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.ae"
                autoComplete="email"
                disabled={isSigningIn}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isSigningIn}
                  className="pr-10"
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">Email code required for every sign-in</p>
                  <p className="text-muted-foreground">
                    Enter the 6-digit code we sent to your email.
                    {expiresInMinutes ? ` Code expires in ${expiresInMinutes} minutes.` : ""}
                  </p>
                  {hasAuthenticatorApp && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      You can also use your authenticator app code.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">Authentication Code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                autoComplete="one-time-code"
                disabled={isSigningIn}
                {...register("otp")}
              />
              {errors.otp && (
                <p className="text-sm text-destructive">{errors.otp.message}</p>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              className="px-0"
              onClick={() => {
                setStep("credentials");
                setPendingEmail("");
                setPendingPassword("");
                setExpiresInMinutes(null);
                setHasAuthenticatorApp(false);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to email and password
            </Button>
          </>
        )}

        <Button type="submit" className="w-full" disabled={isSigningIn}>
          {isSigningIn ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            step === "credentials" ? "Continue" : "Verify and sign in"
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        Continue with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-8 w-40" />
        <Skeleton className="mx-auto h-4 w-60" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
