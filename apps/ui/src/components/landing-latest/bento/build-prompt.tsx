"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { useGSAP } from "@gsap/react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowUpRight, ChevronDown, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

gsap.registerPlugin(useGSAP)

const PLACEHOLDERS = [
  "What can I do for you?",
  "Build a pricing page with three tiers…",
  "Review this React component for a11y…",
  "Scaffold a tRPC router for rooms…",
]

export default function BuildPrompt() {
  const rootRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState("")
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const reduce = useReducedMotion()
  const canSend = value.trim().length > 0

  useGSAP(
    () => {
      const root = rootRef.current
      const spot = spotRef.current
      if (!root || !spot || reduce) return

      const pos = { x: 0, y: 0 }
      const apply = () => {
        spot.style.setProperty("--spot-x", `${pos.x}px`)
        spot.style.setProperty("--spot-y", `${pos.y}px`)
      }
      const xTo = gsap.quickTo(pos, "x", { duration: 0.4, ease: "power3", onUpdate: apply })
      const yTo = gsap.quickTo(pos, "y", { duration: 0.4, ease: "power3", onUpdate: apply })

      const onMove = (event: PointerEvent) => {
        const rect = root.getBoundingClientRect()
        xTo(event.clientX - rect.left)
        yTo(event.clientY - rect.top)
      }

      root.addEventListener("pointermove", onMove)
      return () => root.removeEventListener("pointermove", onMove)
    },
    { scope: rootRef, dependencies: [reduce] },
  )

  useEffect(() => {
    if (value) return
    const id = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % PLACEHOLDERS.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [value])

  return (
    <div
      ref={rootRef}
      className="group relative flex min-h-60 items-center justify-center overflow-hidden p-6"
      role="img"
      aria-label="Prompt composer that turns a short request into a generated workspace"
    >
      <div
        ref={spotRef}
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--primary) / 0.18) 1px, transparent 1px), linear-gradient(hsl(var(--primary) / 0.08), transparent)",
          backgroundSize: "22px 22px, 100% 100%",
          maskImage:
            "radial-gradient(160px at var(--spot-x, 50%) var(--spot-y, 50%), black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(160px at var(--spot-x, 50%) var(--spot-y, 50%), black 0%, transparent 70%)",
        }}
      />

      <div className="group/prompt relative z-2 w-full max-w-xl rounded-xl border border-border bg-background/80 shadow-md backdrop-blur-sm">
        <Textarea
          id="bento-text-prompt"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          className="bg-background! field-sizing-content max-h-30 min-h-32 resize-none rounded-xl border-0 p-4 pb-14 text-lg! shadow-none focus-visible:ring-0"
        />
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              tabIndex={0}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <img src="/Orin-logo.svg" alt="" className="size-4.5 dark:invert" />
              <span>Orin</span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
            <span className="bg-border h-5 w-px" />
            <Button type="button" variant="ghost" size="icon-sm" className="bg-primary/10 text-primary hover:bg-primary/20">
              <Paperclip />
              <span className="sr-only">Attach a file</span>
            </Button>
          </div>
          <motion.div
            animate={canSend && !reduce ? { scale: 1, opacity: 1 } : { scale: 0.92, opacity: 0.55 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
          >
            <Button type="button" size="icon-sm" disabled={!canSend} aria-label="Send prompt">
              <ArrowUpRight />
              <span className="sr-only">Send prompt</span>
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="from-card pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b to-transparent" />
      <div className="from-card pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l to-transparent" />
      <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t to-transparent" />
      <div className="from-card pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r to-transparent" />
    </div>
  )
}
