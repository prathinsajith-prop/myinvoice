"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { jsonFetcher } from "@/lib/fetcher";

interface InviteData {
  email: string;
  role: string;
  organization: { name: string; slug: string };
  inviterName: string;
  expiresAt: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const invitePath = token ? `/api/invite?token=${encodeURIComponent(token)}` : null;
  const {
    data: invite,
    error,
    isLoading,
  } = useSWR<InviteData>(invitePath, jsonFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  useEffect(() => {
    if (!invite) {
      return;
    }

    setName((currentName) => currentName || invite.email.split("@")[0]);
  }, [invite]);

  async function handleAccept() {
    if (!name.trim()) return toast.error("Name is required");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");

    setSubmitting(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to accept invitation");

      setAccepted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || error || !invite) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              {!token ? "No invite token found." : error instanceof Error ? error.message : "Failed to load invitation."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <CardTitle>You&apos;re in!</CardTitle>
            <CardDescription>
              Your account has been created. Sign in to access {invite.organization.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground font-medium">
              {invite?.organization.name}
            </span>
          </div>
          <CardTitle>Accept your invitation</CardTitle>
          <CardDescription>
            <strong>{invite?.inviterName}</strong> invited you to join as{" "}
            <strong>{invite?.role.toLowerCase()}</strong>. Create your account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={invite?.email ?? ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 chars, upper + lower + number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAccept()}
              disabled={submitting}
            />
          </div>
          <Button className="w-full" onClick={handleAccept} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</>
            ) : (
              "Accept & create account"
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="underline">Sign in instead</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
