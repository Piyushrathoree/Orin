"use client";

import Logo from "@/components/mine/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function SignInPage() {
  return (
    <section className="flex min-h-screen bg-background px-4 py-16 md:py-32">
      <div className="m-auto h-fit w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card/80 p-6">
          <div>
            <Link href="/" aria-label="go home">
              <Logo />
            </Link>
            <h1 className="mb-1 mt-4 text-xl font-semibold text-foreground">
              Sign In to Orin
            </h1>
            <p className="text-muted-foreground">Auth coming soon</p>
          </div>

          <form
            className="mt-6 space-y-6"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="block text-sm text-foreground">
                Email
              </Label>
              <Input
                type="email"
                name="email"
                id="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="block text-sm text-foreground"
              >
                Password
              </Label>
              <Input
                type="password"
                name="password"
                id="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary-dark"
            >
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?
            <Button asChild variant="link" className="px-2 text-primary">
              <Link href="/sign-up">Create account</Link>
            </Button>
          </p>
        </div>
      </div>
    </section>
  );
}
