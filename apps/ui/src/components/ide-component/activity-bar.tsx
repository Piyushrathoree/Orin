"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { File, Search, Terminal, BotMessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

type SidebarProps = {
  showExplorer: boolean;
  setShowExplorer: Dispatch<SetStateAction<boolean>>;
  showSearch: boolean;
  setShowSearch: Dispatch<SetStateAction<boolean>>;
  showTerminal: boolean;
  setShowTerminal: Dispatch<SetStateAction<boolean>>;
  showAiChat: boolean;
  setShowAiChat: Dispatch<SetStateAction<boolean>>;
};

function ActivityButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "relative flex h-10 w-full items-center justify-center",
            "text-muted-foreground/50 transition-colors hover:text-foreground",
            active && "text-primary",
          )}
        >
          {active && (
            <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
          )}
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

const ActivityBar = ({
  showExplorer,
  setShowExplorer,
  showSearch,
  setShowSearch,
  showTerminal,
  setShowTerminal,
  showAiChat,
  setShowAiChat,
}: SidebarProps) => {
  return (
    <div className="z-50 flex h-full w-12 shrink-0 flex-col justify-between border-r border-border bg-sidebar py-2">
      <div className="flex flex-col items-stretch gap-1">
        <Link
          href="/"
          className="mb-1 flex h-10 items-center justify-center"
          aria-label="Orin home"
        >
          <Image
            src="/Orin-logo.svg"
            alt="Orin logo"
            width={20}
            height={20}
            className="size-5 invert dark:invert-0"
            priority
          />
        </Link>
        <ActivityButton
          active={showExplorer}
          label="Explorer (Ctrl+B)"
          onClick={() => {
            setShowExplorer((prev) => !prev);
            if (!showExplorer) setShowSearch(false);
          }}
        >
          <File className="size-5" />
        </ActivityButton>
        <ActivityButton
          active={showSearch}
          label="Search (Ctrl+Shift+F)"
          onClick={() => {
            setShowSearch((prev) => !prev);
            if (!showSearch) setShowExplorer(false);
          }}
        >
          <Search className="size-5" />
        </ActivityButton>
        <ActivityButton
          active={showTerminal}
          label="Terminal (Ctrl+`)"
          onClick={() => setShowTerminal((prev) => !prev)}
        >
          <Terminal className="size-5" />
        </ActivityButton>
      </div>

      <div className="flex flex-col items-stretch gap-1">
        <ActivityButton
          active={showAiChat}
          label="AI Chat (Ctrl+Shift+A)"
          onClick={() => setShowAiChat((prev) => !prev)}
        >
          <BotMessageSquare className="size-5" />
        </ActivityButton>
        <div className="flex h-10 items-center justify-center">
          <ThemeToggle />
        </div>
        <div className="flex h-10 items-center justify-center">
          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  userButtonAvatarBox: "size-7",
                  userButtonTrigger: "size-7",
                },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </div>
  );
};

export default ActivityBar;
