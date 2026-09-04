import React from "react";
import {
  SiTypescript,
  SiJavascript,
  SiHtml5,
  SiCss,
  SiJson,
  SiMarkdown,
  SiReact,
  SiVite,
  SiTailwindcss,
  SiPostcss,
} from "react-icons/si";
import { VscFileCode } from "react-icons/vsc";
import { FileImage, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileIconProps {
  filename: string;
  className?: string;
}

export const FileIconCustom = ({ filename, className = "size-4" }: FileIconProps) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  const name = filename.toLowerCase();
  const iconClass = cn("shrink-0", className);

  if (name === "package.json") return <SiJson className={cn(iconClass, "text-[#CBCB41]")} />;
  if (name === "tsconfig.json") return <SiTypescript className={cn(iconClass, "text-[#3178C6]")} />;
  if (name === "vite.config.ts" || name === "vite.config.js") {
    return <SiVite className={cn(iconClass, "text-[#646CFF]")} />;
  }
  if (name === "tailwind.config.js" || name === "tailwind.config.ts") {
    return <SiTailwindcss className={cn(iconClass, "text-[#38BDF8]")} />;
  }
  if (name === "postcss.config.js") return <SiPostcss className={cn(iconClass, "text-[#DD3A0A]")} />;

  switch (extension) {
    case "ts":
      return <SiTypescript className={cn(iconClass, "text-[#3178C6]")} />;
    case "tsx":
      return <SiReact className={cn(iconClass, "text-[#61DAFB]")} />;
    case "js":
      return <SiJavascript className={cn(iconClass, "text-[#F7DF1E]")} />;
    case "jsx":
      return <SiReact className={cn(iconClass, "text-[#61DAFB]")} />;
    case "html":
      return <SiHtml5 className={cn(iconClass, "text-[#E34F26]")} />;
    case "css":
      return <SiCss className={cn(iconClass, "text-[#1572B6]")} />;
    case "json":
      return <SiJson className={cn(iconClass, "text-[#CBCB41]")} />;
    case "md":
      return <SiMarkdown className={cn(iconClass, "text-muted-foreground")} />;
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return <FileImage className={cn(iconClass, "text-muted-foreground")} />;
    case "sh":
    case "bash":
    case "zsh":
      return <VscFileCode className={cn(iconClass, "text-muted-foreground")} />;
    default:
      return <File className={cn(iconClass, "text-muted-foreground")} />;
  }
};
