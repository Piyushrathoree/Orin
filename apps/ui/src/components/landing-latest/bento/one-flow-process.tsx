"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { useGSAP } from "@gsap/react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP)

const STEPS = [
  "Analyzing search results...",
  "Generating summary...",
  "Checking for relevant information...",
  "Finalizing analysis...",
  "Setting up lazy loading...",
  "Streaming structured output...",
]

const STATIC_STEPS = STEPS.slice(0, 4)

function controlTween(tween: gsap.core.Tween | null | undefined, shouldPlay: boolean) {
  if (!tween) return
  if (typeof tween.play !== "function" || typeof tween.pause !== "function") return
  const targets = typeof tween.targets === "function" ? tween.targets() : undefined
  if (!targets?.length) return
  try {
    if (shouldPlay) tween.play()
    else tween.pause()
  } catch {
    // Reverted tweens can throw on play/pause
  }
}

function StepRow({
  step,
  index,
  active,
  dim,
}: {
  step: string
  index: number
  active?: boolean
  dim?: boolean
}) {
  return (
    <div
      className={cn(
        "flow-line flex items-center text-sm font-medium",
        active ? "text-primary" : "text-muted-foreground",
        dim && "opacity-45",
      )}
    >
      <span className="w-6 shrink-0 pr-3 tabular-nums select-none">{(index % STEPS.length) + 1}.</span>
      <span className="line-clamp-1 flex-1">{step}</span>
    </div>
  )
}

export default function OneFlowProcess() {
  const rootRef = useRef<HTMLDivElement>(null)
  const clipRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const inView = useInView(rootRef, { amount: 0.35 })
  const reduce = useReducedMotion()
  const [hovered, setHovered] = useState(false)

  useGSAP(
    () => {
      const list = listRef.current
      const clip = clipRef.current
      if (!list || !clip || reduce) {
        tweenRef.current = null
        return
      }

      const lines = gsap.utils.toArray<HTMLElement>(".flow-line", list)
      const emphasize = () => {
        const clipRect = clip.getBoundingClientRect()
        const focusY = clipRect.top + clipRect.height * 0.36
        const range = Math.max(clipRect.height * 0.4, 1)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const mid = line.getBoundingClientRect().top + line.offsetHeight * 0.5
          const t = Math.min(Math.abs(mid - focusY) / range, 1)
          line.style.opacity = String(1 - t * 0.72)
          line.style.color = t < 0.28 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
        }
      }

      const tween = gsap.to(list, {
        yPercent: -50,
        duration: 18,
        ease: "none",
        repeat: -1,
        onUpdate: emphasize,
      })
      tweenRef.current = tween
      emphasize()
      if (!inView) tween.pause()

      return () => {
        tweenRef.current = null
      }
    },
    { scope: rootRef, dependencies: [reduce] },
  )

  useEffect(() => {
    controlTween(tweenRef.current, inView && !reduce && !hovered)
  }, [hovered, inView, reduce])

  const rows = reduce ? STATIC_STEPS : [...STEPS, ...STEPS]

  return (
    <div
      ref={rootRef}
      className="flex h-full flex-col px-4 pt-7"
      role="img"
      aria-label="A single research flow stepping through analysis in sequence"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="text-muted-foreground flex shrink-0 items-center gap-2 px-1 pb-3 font-medium">
        <motion.span
          className="border-muted-foreground/25 border-t-muted-foreground size-4 shrink-0 rounded-full border-2"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 1.15, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
        />
        <span className="text-sm">Analyzing results...</span>
      </div>

      <div ref={clipRef} className="relative min-h-0 flex-1 overflow-hidden rounded-t-xl">
        <div className="bg-muted h-full overflow-hidden px-3 py-3">
          <div ref={listRef} className="flex flex-col gap-2 will-change-transform">
            {rows.map((step, index) => (
              <StepRow
                key={`${step}-${index}`}
                step={step}
                index={index}
                active={Boolean(reduce && index === 1)}
                dim={Boolean(reduce && index !== 1)}
              />
            ))}
          </div>
        </div>
        <div className="from-muted pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b to-transparent" />
        <div className="from-muted pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-linear-to-t to-transparent" />
      </div>
    </div>
  )
}
