"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-[13px] leading-relaxed rounded-sm border px-4 py-2 wrap-break-word whitespace-pre-wrap shadow-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-user]:border-primary-dark",
      "group-[.is-assistant]:bg-primary/5 group-[.is-assistant]:text-foreground group-[.is-assistant]:border-primary/10",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
