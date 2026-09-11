"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { FilePlus2 } from "lucide-react"

type Beat = "ask" | "write" | "done"

export default function PickYourTool() {
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { amount: 0.4 })
  const reduce = useReducedMotion()
  const [beat, setBeat] = useState<Beat>("done")

  useEffect(() => {
    if (reduce) {
      setBeat("done")
      return
    }
    if (!inView) return

    let cancelled = false
    const ids: number[] = []
    const later = (fn: () => void, ms: number) => {
      ids.push(window.setTimeout(fn, ms))
    }

    const cycle = () => {
      if (cancelled) return
      setBeat("ask")
      later(() => setBeat("write"), 900)
      later(() => setBeat("done"), 1900)
      later(cycle, 4600)
    }
    cycle()

    return () => {
      cancelled = true
      for (const id of ids) window.clearTimeout(id)
    }
  }, [inView, reduce])

  const showWrite = beat === "write" || beat === "done"
  const showPreview = beat === "done"

  return (
    <div
      ref={rootRef}
      className="relative flex h-full items-center justify-center p-4"
      role="img"
      aria-label="Asking Orin to add a pricing card, then seeing it appear in the live preview"
    >
      <div className="flex h-full w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
        <div className="flex w-[44%] min-w-0 flex-col gap-2 border-r border-border/80 p-2.5">
          <p className="text-[10px] font-medium text-muted-foreground">Chat</p>
          <div className="ml-auto max-w-[95%] rounded-lg bg-primary/15 px-2 py-1.5 text-left text-[10px] leading-4 text-foreground">
            Add a pricing card for the Pro plan
          </div>
          <AnimatePresence>
            {showWrite && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="mr-auto max-w-[95%] space-y-1.5 rounded-lg border border-border/70 bg-card px-2 py-1.5 text-left"
              >
                <p className="text-[10px] leading-4 text-muted-foreground">
                  Writing the component into the workspace.
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-primary">
                  <FilePlus2 className="size-3" aria-hidden="true" />
                  PricingCard.tsx
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border/80 px-2.5 py-1.5">
            <span className="text-[10px] text-muted-foreground">Preview</span>
            <span className="size-1.5 rounded-full bg-primary" />
          </div>
          <div className="flex flex-1 items-center justify-center bg-muted/20 p-3">
            <AnimatePresence mode="wait" initial={false}>
              {showPreview ? (
                <motion.div
                  key="card"
                  initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  className="w-full max-w-[148px] rounded-xl border border-border bg-card p-3 text-left shadow-md"
                >
                  <p className="text-[10px] text-muted-foreground">Pro</p>
                  <p className="mt-1 text-lg font-semibold leading-none text-foreground">
                    $12
                    <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">/mo</span>
                  </p>
                  <div className="mt-3 h-6 rounded-md bg-primary text-[9px] font-medium leading-6 text-primary-foreground text-center">
                    Subscribe
                  </div>
                </motion.div>
              ) : (
                <motion.p
                  key="empty"
                  exit={reduce ? undefined : { opacity: 0 }}
                  className="text-[10px] text-muted-foreground"
                >
                  Waiting for a change
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
