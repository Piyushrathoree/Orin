"use client";

import { SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { ArrowUp, ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DEFAULT_MODEL = "Fable 5";

export function PromptLauncher() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [fastMode, setFastMode] = useState(true);
  const [model] = useState(DEFAULT_MODEL);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerLabel = fastMode ? `${model} Fast` : model;

  const openWorkspace = useCallback(() => {
    const value = prompt.trim();
    router.push(value ? `/room?prompt=${encodeURIComponent(value)}` : "/room");
  }, [prompt, router]);

  const handleSubmit = useCallback(() => {
    if (isSignedIn) {
      openWorkspace();
    } else {
      router.push("/sign-up");
    }
  }, [isSignedIn, openWorkspace, router]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        "relative z-10 mt-5 w-full max-w-xl overflow-hidden rounded-2xl",
        "border border-border bg-background/75 text-left shadow-lg backdrop-blur-md dark:shadow-2xl",
      )}
    >
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the app you want Orin to build..."
        className={cn(
          "min-h-[88px] resize-none border-0 bg-transparent px-4 pt-4 pb-1",
          "text-sm shadow-none placeholder:text-muted-foreground/55",
          "focus-visible:ring-0 md:min-h-[96px] md:text-[15px]",
        )}
        aria-label="Describe your app"
      />

      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
                "text-xs text-muted-foreground/70 transition-colors",
                "hover:bg-muted/60 hover:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
              aria-label={`Model and options: ${triggerLabel}`}
            >
              <span>{triggerLabel}</span>
              <ChevronDown className="size-3 opacity-60" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            className="w-56 rounded-xl border-border bg-background/95 p-0 shadow-xl backdrop-blur-md"
          >
            <PopoverTitle className="sr-only">Model and options</PopoverTitle>
            <div className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
                Options
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="orin-fast-mode"
                  className="text-sm text-foreground"
                >
                  Fast
                </label>
                <Switch
                  id="orin-fast-mode"
                  checked={fastMode}
                  onCheckedChange={setFastMode}
                  size="sm"
                  aria-label="Fast mode"
                />
              </div>
            </div>
            <Separator className="bg-white/10" />
            <div className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
                Model
              </p>
              <button
                type="button"
                className={cn(
                  "mt-2 flex w-full items-center justify-between rounded-md px-1 py-1.5",
                  "text-sm text-foreground transition-colors hover:bg-white/5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                )}
                aria-label={`Selected model: ${model}`}
              >
                <span>{model}</span>
                <ChevronRight
                  className="size-3.5 text-muted-foreground/60"
                  aria-hidden
                />
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex shrink-0 items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            aria-hidden
            onChange={() => {
              // File selection handled here when upload flow is wired up
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-full text-muted-foreground/40 hover:text-muted-foreground"
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-4" />
            <span className="sr-only">Attach file</span>
          </Button>

          <SignedOut>
            <Button
              asChild
              size="icon-sm"
              className="size-8 rounded-full shadow-sm"
              aria-label="Sign up to start building"
            >
              <Link href="/sign-up">
                <ArrowUp className="size-4" />
                <span className="sr-only">Sign up to start building</span>
              </Link>
            </Button>
          </SignedOut>

          <SignedIn>
            <Button
              type="button"
              size="icon-sm"
              onClick={openWorkspace}
              className="size-8 rounded-full shadow-sm"
              aria-label="Generate with Orin"
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">Generate with Orin</span>
            </Button>
          </SignedIn>
        </div>
      </div>
    </div>
  );
}
