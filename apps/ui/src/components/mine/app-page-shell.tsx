import type { ReactNode } from "react";
import Logo from "@/components/mine/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";

type AppPageShellProps = {
  actions: ReactNode;
  children: ReactNode;
};

export function AppPageShell({ actions, children }: AppPageShellProps) {
  const inner = "mx-auto w-full max-w-5xl px-6 sm:px-10";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className={cn(inner, "flex items-center justify-between gap-4 py-4")}>
          <Link href="/main" className="shrink-0">
            <Logo />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
        </div>
      </header>
      <main className={cn(inner, "py-8")}>{children}</main>
    </div>
  );
}
