"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { useGSAP } from "@gsap/react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { Mic } from "lucide-react"

gsap.registerPlugin(useGSAP)

const BAR_COUNT = 48

function formatTime(total: number) {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0")
  const seconds = (total % 60).toString().padStart(2, "0")
  return `${minutes}:${seconds}`
}

export default function VoiceAssistant() {
  const rootRef = useRef<HTMLDivElement>(null)
  const tweensRef = useRef<gsap.core.Tween[]>([])
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const inView = useInView(rootRef, { amount: 0.35 })
  const reduce = useReducedMotion()

  useGSAP(
    () => {
      const bars = gsap.utils.toArray<HTMLElement>(".wave-bar")
      gsap.set(bars, { scaleY: 0.18, transformOrigin: "center bottom" })
      if (reduce) return

      tweensRef.current = bars.map((bar, index) =>
        gsap.to(bar, {
          scaleY: () => gsap.utils.random(0.2, 1),
          duration: () => gsap.utils.random(0.12, 0.28),
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          paused: true,
          delay: index * 0.012,
        }),
      )
    },
    { scope: rootRef, dependencies: [reduce] },
  )

  useEffect(() => {
    const tweens = tweensRef.current
    if (recording && inView && !reduce) {
      for (const tween of tweens) tween.play()
      return
    }
    for (const tween of tweens) tween.pause()
    const bars = rootRef.current?.querySelectorAll<HTMLElement>(".wave-bar")
    if (bars?.length) {
      gsap.to(bars, {
        scaleY: 0.18,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      })
    }
  }, [recording, inView, reduce])

  useEffect(() => {
    if (!recording) {
      setElapsed(0)
      return
    }
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [recording])

  return (
    <div
      ref={rootRef}
      className="flex h-full flex-1 items-center justify-center"
      role="img"
      aria-label="Voice assistant with a live waveform you can start and stop"
    >
      <div className="relative flex w-full max-w-50 flex-col items-center gap-3">
        <motion.button
          className="relative flex size-14 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-accent"
          type="button"
          aria-pressed={recording}
          aria-label={recording ? "Stop speaking" : "Click to speak"}
          onClick={() => setRecording((value) => !value)}
          whileHover={reduce ? undefined : { scale: 1.06 }}
          whileTap={reduce ? undefined : { scale: 0.92 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        >
          {recording ? (
            <span className="absolute inset-0 rounded-xl bg-primary/15" />
          ) : null}
          <Mic className="size-9 stroke-[1.5]" aria-hidden="true" />
        </motion.button>
        <span className="text-muted-foreground font-mono text-sm font-light tabular-nums">
          {formatTime(elapsed)}
        </span>
        <div className="flex h-4 w-50 items-end justify-center gap-0.5 px-1 py-0.5">
          {Array.from({ length: BAR_COUNT }).map((_, index) => (
            <div
              key={index}
              className="wave-bar w-0.5 origin-bottom rounded-full bg-muted-foreground"
              style={{ height: 16 }}
            />
          ))}
        </div>
        <p className="text-card-foreground">{recording ? "Listening…" : "Click to speak"}</p>
      </div>
    </div>
  )
}
