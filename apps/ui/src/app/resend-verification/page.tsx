"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import AuthPage from "@/components/auth/auth-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "Could not send verification email");
      setMessage(payload.message || "If your account needs verification, a link has been sent.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not send verification email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPage
      title="Verify your email"
      description="Enter your email and we’ll send you a fresh verification link."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>
        {message && <p className="text-sm text-primary">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send verification link"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link className="text-primary hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </AuthPage>
  );
}
