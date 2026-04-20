"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { registerAction } from "@/lib/auth/actions";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  getCountryOptions,
  BUSINESS_TYPES,
  type CountryOption,
} from "@/lib/utils/countries";

const STEPS = [
  { id: 1, title: "Your Account", icon: UserPlus },
  { id: 2, title: "Organization", icon: Building2 },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const { isRegistering, setRegistering } = useAuthStore();

  const countries = useMemo(() => getCountryOptions(), []);
  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c: CountryOption) =>
        c.label.toLowerCase().includes(q) ||
        c.value.toLowerCase().includes(q)
    );
  }, [countries, countrySearch]);

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      country: "AE",
      businessType: "",
    },
  });

  const selectedCountry = watch("country");
  const selectedCountryData = useMemo(
    () => countries.find((c: CountryOption) => c.value === selectedCountry),
    [countries, selectedCountry]
  );

  const handleNext = async () => {
    const valid = await trigger(["name", "email", "password", "confirmPassword"]);
    if (valid) setStep(2);
  };

  const onSubmit = async (data: RegisterInput) => {
    setRegistering(true);
    try {
      const result = await registerAction(data);

      if (result.success) {
        toast.success("Account created successfully!");
        router.push("/login?registered=true");
      } else if (result.errors) {
        const errorEntries = Object.entries(result.errors);
        const step1Fields = ["name", "email", "password", "confirmPassword"];
        const hasStep1Error = errorEntries.some(([key]) => step1Fields.includes(key));
        if (hasStep1Error) setStep(1);
        errorEntries.forEach(([, messages]) => {
          if (messages?.[0]) toast.error(messages[0]);
        });
      } else if (result.message) {
        if (result.message.toLowerCase().includes("email")) setStep(1);
        toast.error(result.message);
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      toast.error("An error occurred. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
        <p className="text-muted-foreground">
          {step === 1
            ? "Set up your admin account"
            : "Tell us about your organization"}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-3">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${isCompleted ? "bg-primary" : "bg-border"}`}
                />
              )}
              <Button
                type="button"
                variant={isActive ? "default" : isCompleted ? "ghost" : "secondary"}
                size="sm"
                onClick={() => isCompleted && setStep(s.id)}
                className={`rounded-full gap-2 ${isCompleted && !isActive
                  ? "bg-primary/10 text-primary cursor-pointer"
                  : !isActive && !isCompleted
                    ? "text-muted-foreground"
                    : ""
                  }`}
              >
                <Icon className="h-4 w-4" />
                {s.title}
              </Button>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {step === 1 ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="name" required>Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ahmed Al Maktoum"
                autoComplete="name"
                disabled={isRegistering}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" required>Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.ae"
                autoComplete="email"
                disabled={isRegistering}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" required>Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isRegistering}
                  className="pr-10"
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password ? (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Min 8 characters, with uppercase, lowercase, and a number
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" required>Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isRegistering}
                  className="pr-10"
                  {...register("confirmPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={handleNext}
              disabled={isRegistering}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="organizationName" required>Organization Name</Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="My Company LLC"
                disabled={isRegistering}
                {...register("organizationName")}
              />
              {errors.organizationName && (
                <p className="text-sm text-destructive">{errors.organizationName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Business Type</Label>
              <Select
                value={watch("businessType") || ""}
                onValueChange={(v) => setValue("businessType", v)}
                disabled={isRegistering}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((bt) => (
                    <SelectItem key={bt.value} value={bt.value}>
                      {bt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.businessType && (
                <p className="text-sm text-destructive">{errors.businessType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={selectedCountry}
                onValueChange={(v) => setValue("country", v)}
                disabled={isRegistering}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country">
                    {selectedCountryData && (
                      <span className="flex items-center gap-2">
                        <span>{selectedCountryData.flag}</span>
                        <span>{selectedCountryData.label}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 bg-popover px-2 pb-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search country..."
                        className="pl-8"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {filteredCountries.map((c: CountryOption) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span>{c.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && (
                <p className="text-sm text-destructive">{errors.country.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                You can update this and more details later in settings
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={isRegistering}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isRegistering}>
                {isRegistering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </div>
          </>
        )}
      </form>

      {step === 1 && (
        <>
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
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
