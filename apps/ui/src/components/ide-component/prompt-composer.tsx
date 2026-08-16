"use client";

import {
  ArrowUp,
  AtSign,
  ChevronDown,
  ChevronRight,
  Loader2,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
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

export type ComposerContextFile = {
  name: string;
  path: string;
};

interface IdePromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  currentFile?: ComposerContextFile | null;
  modeLabel?: string;
  showModelSelector?: boolean;
  onAttach?: () => void;
  attachHiddenInput?: ReactNode;
}

export function IdePromptComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Plan, search, build anything",
  disabled = false,
  loading = false,
  currentFile = null,
  modeLabel = "Chat",
  showModelSelector = true,
  onAttach,
  attachHiddenInput,
}: IdePromptComposerProps) {
  const [fastMode, setFastMode] = useState(true);
  const [model] = useState(DEFAULT_MODEL);
  const [contextOn, setContextOn] = useState(false);
  const localFileRef = useRef<HTMLInputElement>(null);

  const modelLabel = fastMode ? model : `${model} · Standard`;
  const canSubmit = value.trim().length > 0 && !disabled && !loading;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  const handleAttachClick = () => {
    if (onAttach) {
      onAttach();
      return;
    }
    localFileRef.current?.click();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        "border border-border/80 bg-sidebar/90",
        "shadow-sm dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.45)]",
        "backdrop-blur-xl",
      )}
    >
      {currentFile && (
        <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-3 py-2">
          {contextOn ? (
            <button
              type="button"
              onClick={() => setContextOn(false)}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
            >
              <AtSign className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{currentFile.name}</span>
              <X className="size-3 shrink-0 opacity-60" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setContextOn(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
            >
              <AtSign className="size-3 text-muted-foreground/70" aria-hidden />
              Add context
            </button>
          )}
        </div>
      )}

      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className={cn(
          "max-h-28 min-h-[52px] resize-none rounded-none border-0 bg-transparent px-3 py-2.5",
          "text-[13px] leading-relaxed shadow-none",
          "placeholder:text-muted-foreground/45",
          "focus-visible:ring-0",
        )}
        aria-label="Chat message"
      />

      <div className="flex items-center gap-1 border-t border-border/50 px-2 py-1.5">
        <div className="flex shrink-0 items-center gap-1 px-1 text-muted-foreground/55">
          <Sparkles className="size-3.5" aria-hidden />
          <span className="text-[11px] font-medium">{modeLabel}</span>
        </div>

        {showModelSelector && (
          <>
            <span className="mx-0.5 h-3 w-px shrink-0 bg-border/80" aria-hidden />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex max-w-[120px] items-center gap-0.5 truncate rounded-md px-1.5 py-0.5",
                    "text-[11px] text-muted-foreground/70 transition-colors",
                    "hover:bg-muted/50 hover:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  )}
                  aria-label={`Model: ${modelLabel}`}
                >
                  <span className="truncate">{modelLabel}</span>
                  <ChevronDown className="size-3 shrink-0 opacity-50" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                className="w-52 rounded-xl border-border/80 bg-popover/95 p-0 shadow-xl backdrop-blur-md"
              >
                <PopoverTitle className="sr-only">Model and options</PopoverTitle>
                <div className="p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/55">
                    Options
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <label htmlFor="orin-ide-fast-mode" className="text-xs text-foreground">
                      Fast mode
                    </label>
                    <Switch
                      id="orin-ide-fast-mode"
                      checked={fastMode}
                      onCheckedChange={setFastMode}
                      size="sm"
                      aria-label="Fast mode"
                    />
                  </div>
                </div>
                <Separator className="bg-border/60" />
                <div className="p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/55">
                    Model
                  </p>
                  <button
                    type="button"
                    className={cn(
                      "mt-1.5 flex w-full items-center justify-between rounded-md px-1 py-1",
                      "text-xs text-foreground transition-colors hover:bg-muted/50",
                    )}
                    aria-label={`Selected model: ${model}`}
                  >
                    <span>{model}</span>
                    <ChevronRight className="size-3 text-muted-foreground/50" aria-hidden />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-0.5">
          {attachHiddenInput}
          {!attachHiddenInput && (
            <input ref={localFileRef} type="file" className="sr-only" aria-hidden />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 rounded-md text-muted-foreground/45 hover:bg-muted/50 hover:text-muted-foreground"
            aria-label="Attach file"
            onClick={handleAttachClick}
            disabled={disabled}
          >
            <Paperclip className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="icon-sm"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={cn(
              "size-7 rounded-full transition-all",
              canSubmit
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "bg-muted/60 text-muted-foreground/40",
            )}
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
