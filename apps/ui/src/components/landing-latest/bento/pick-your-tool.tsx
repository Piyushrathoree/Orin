"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"
import { useGSAP } from "@gsap/react"
import { motion, useInView, useReducedMotion } from "motion/react"

gsap.registerPlugin(MotionPathPlugin, useGSAP)

const TOOLS = [
  { src: "/images/mcp-integrations/figma.svg", alt: "Figma" },
  { src: "/images/mcp-integrations/react.svg", alt: "React" },
  { src: "/images/mcp-integrations/nextjs.svg", alt: "Next.js" },
  { src: "/images/mcp-integrations/tailwind-css.svg", alt: "Tailwind CSS" },
  { src: "/images/mcp-integrations/shadcn.svg", alt: "shadcn/ui" },
  { src: "/images/mcp-integrations/resend.svg", alt: "Resend" },
  { src: "/Orin-logo.svg", alt: "Orin" },
  { src: "/images/mcp-integrations/figma.svg", alt: "Figma" },
]

function Orbit({
  className,
  pathClass,
  badgeClass,
  tools,
}: {
  className: string
  pathClass: string
  badgeClass: string
  tools: typeof TOOLS
}) {
  return (
    <div className={className}>
      <svg width="220" height="220" viewBox="0 0 303 303" fill="none" aria-hidden="true">
        <path
          className={pathClass}
          d="M301.5 151.5 A150 150 0 1 1 1.5 151.5 A150 150 0 1 1 301.5 151.5 Z"
          stroke="hsl(var(--border))"
          strokeWidth="2"
          fill="hsl(var(--secondary) / 0.12)"
        />
      </svg>
      {tools.map((tool, index) => (
        <div key={`${tool.alt}-${index}`} className={`${badgeClass} absolute top-0 left-0 opacity-0`}>
          <div className="bg-background grid size-10 shrink-0 place-content-center overflow-hidden rounded-full border border-border shadow-sm transition-transform duration-300 hover:scale-110">
            <img src={tool.src} alt={tool.alt} className="size-5 object-contain" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PickYourTool() {
  const rootRef = useRef<HTMLDivElement>(null)
  const tweensRef = useRef<gsap.core.Tween[]>([])
  const inView = useInView(rootRef, { amount: 0.3 })
  const reduce = useReducedMotion()

  useGSAP(
    () => {
      const animate = (badges: Element[], path: string, duration: number, reverse = false) => {
        return badges.map((badge, i) => {
          const start = i / badges.length
          return gsap.to(badge, {
            motionPath: {
              path,
              align: path,
              alignOrigin: [0.5, 0.5],
              autoRotate: false,
              start: reverse ? start + 1 : start,
              end: reverse ? start : start + 1,
            },
            duration,
            repeat: -1,
            ease: "none",
          })
        })
      }

      const leftBadges = gsap.utils.toArray<Element>(".orbit-badge-left")
      const rightBadges = gsap.utils.toArray<Element>(".orbit-badge-right")

      tweensRef.current = [
        ...animate(leftBadges, ".orbit-path-left", 22),
        ...animate(rightBadges, ".orbit-path-right", 26, true),
      ]

      gsap.set([...leftBadges, ...rightBadges], { autoAlpha: 1 })

      if (reduce || !inView) {
        for (const tween of tweensRef.current) tween.pause()
      }

      if (!reduce) {
        gsap.to(".tool-hub", {
          scale: 1.06,
          transformOrigin: "50% 50%",
          duration: 1.6,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        })
      }

      return () => {
        tweensRef.current = []
      }
    },
    { scope: rootRef, dependencies: [reduce] },
  )

  useEffect(() => {
    for (const tween of tweensRef.current) {
      if (!tween) continue
      if (typeof tween.play !== "function" || typeof tween.pause !== "function") continue
      const targets = typeof tween.targets === "function" ? tween.targets() : undefined
      if (!targets?.length) continue
      try {
        if (inView && !reduce) tween.play()
        else tween.pause()
      } catch {
        // Reverted MotionPath tweens can throw on play/pause
      }
    }
  }, [inView, reduce])

  const setSpeed = (scale: number) => {
    for (const tween of tweensRef.current) tween.timeScale(scale)
  }

  return (
    <div
      ref={rootRef}
      className="relative h-full overflow-hidden"
      role="img"
      aria-label="AI and developer tools orbiting a central hub"
      onPointerEnter={() => setSpeed(0.35)}
      onPointerLeave={() => setSpeed(1)}
    >
      <svg
        width="143"
        height="100"
        viewBox="0 0 143 100"
        fill="none"
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2"
      >
        <path
          d="M0.5 42.9458V0.5H142.5V42.9458L71.1411 99.2143L0.5 42.9458Z"
          fill="hsl(var(--secondary) / 0.2)"
          stroke="hsl(var(--border))"
        />
      </svg>
      <div className="bg-border absolute top-24 left-1/2 h-36 w-px -translate-x-1/2" />
      <motion.div
        className="tool-hub absolute top-14 left-1/2 grid size-20 -translate-x-1/2 place-content-center rounded-md border border-border bg-black shadow-xl dark:bg-white"
        whileHover={reduce ? undefined : { scale: 1.08, rotate: 8 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
      >
        <svg width="1em" height="1em" viewBox="0 0 128 128" fill="none" className="size-14 text-white dark:text-black" aria-hidden="true">
          <path d="M63.6734 24.8486V49.3899C63.6734 57.4589 57.1322 64.0001 49.0632 64.0001H25.2041" stroke="currentColor" strokeWidth="8.12" />
          <path d="M64.3266 103.152L64.3266 78.6106C64.3266 70.5416 70.8678 64.0003 78.9368 64.0003L102.796 64.0004" stroke="currentColor" strokeWidth="8.12" />
          <line x1="93.3468" y1="35.6108" x2="76.555" y2="52.205" stroke="currentColor" strokeWidth="8.12" />
          <line x1="51.7697" y1="77.0624" x2="34.9778" y2="93.6567" stroke="currentColor" strokeWidth="8.12" />
          <line x1="50.9584" y1="51.3189" x2="34.2651" y2="34.6256" stroke="currentColor" strokeWidth="8.12" />
          <line x1="93.1625" y1="93.6397" x2="76.4692" y2="76.9464" stroke="currentColor" strokeWidth="8.12" />
        </svg>
      </motion.div>

      <Orbit
        className="absolute top-8 right-1/2 -translate-x-12"
        pathClass="orbit-path-left"
        badgeClass="orbit-badge-left"
        tools={TOOLS}
      />
      <Orbit
        className="absolute top-8 left-1/2 translate-x-12"
        pathClass="orbit-path-right"
        badgeClass="orbit-badge-right"
        tools={[...TOOLS].reverse()}
      />

      <div className="from-card pointer-events-none absolute inset-x-0 top-0 h-5 bg-linear-to-b to-transparent" />
      <div className="from-card pointer-events-none absolute inset-y-0 right-0 w-3 bg-linear-to-l to-transparent" />
      <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-linear-to-t to-transparent" />
      <div className="from-card pointer-events-none absolute inset-y-0 left-0 w-3 bg-linear-to-r to-transparent" />
    </div>
  )
}
