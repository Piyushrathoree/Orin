"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthPage from "@/components/auth/auth-page";

export default function VerifyEmailPage() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("This verification link is missing a token.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!response.ok) throw new Error(payload.error || "Could not verify email");
        setState("success");
        setMessage(payload.message || "Email verified successfully.");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Could not verify email");
      });
  }, []);

  return (
    <AuthPage title="Email verification" description="Your Orin account email status.">
      <div className="space-y-5 text-center">
        <p className={state === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message}
        </p>
        {state === "success" && (
          <Link className="text-sm text-primary hover:underline" href="/sign-in">
            Continue to sign in
          </Link>
        )}
        {state === "error" && (
          <Link className="text-sm text-primary hover:underline" href="/resend-verification">
            Request a new verification link
          </Link>
        )}
      </div>
    </AuthPage>
  );
}
