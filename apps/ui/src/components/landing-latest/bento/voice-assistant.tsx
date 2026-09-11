"use client"

import { useState } from "react"
import { Code2, Eye, FileCode2, FolderTree, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

type WorkspaceView = "code" | "preview"

const codeLines = [
  "import { useState } from \"react\"",
  "",
  "export default function App() {",
  "  const [ready, setReady] = useState(true)",
  "  return <main>...</main>",
  "}",
]

export default function WorkspacePanel() {
  const [view, setView] = useState<WorkspaceView>("code")

  return (
    <div
      className="flex h-full items-center justify-center p-5"
      role="img"
      aria-label="Orin workspace switching between a code editor and live preview"
    >
      <div className="w-full max-w-80 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            my-app
          </div>
          <div className="flex rounded-md bg-muted p-0.5">
            <button
              type="button"
              aria-label="Show code"
              aria-pressed={view === "code"}
              onClick={() => setView("code")}
              className={cn(
                "rounded-sm p-1.5 text-muted-foreground transition-colors",
                view === "code" && "bg-accent text-foreground",
              )}
            >
              <Code2 className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Show preview"
              aria-pressed={view === "preview"}
              onClick={() => setView("preview")}
              className={cn(
                "rounded-sm p-1.5 text-muted-foreground transition-colors",
                view === "preview" && "bg-accent text-foreground",
              )}
            >
              <Eye className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {view === "code" ? (
          <div className="grid min-h-36 grid-cols-[92px_1fr] text-[10px] leading-5">
            <div className="border-r border-border bg-sidebar px-3 py-3 text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 text-foreground/80">
                <FolderTree className="size-3" aria-hidden="true" />
                src
              </div>
              <div className="flex items-center gap-1.5 pl-2 text-primary">
                <FileCode2 className="size-3" aria-hidden="true" />
                App.tsx
              </div>
              <div className="pl-6 text-muted-foreground/60">main.tsx</div>
            </div>
            <div className="overflow-hidden px-3 py-3 font-mono text-muted-foreground">
              {codeLines.map((line, index) => (
                <div key={`${line}-${index}`} className="whitespace-nowrap">
                  <span className="mr-3 inline-block w-3 text-right text-muted-foreground/35">
                    {index + 1}
                  </span>
                  <span className={index === 2 ? "text-primary" : ""}>{line || " "}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 bg-muted/30 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Monitor className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Preview is running</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Updates appear as you edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
