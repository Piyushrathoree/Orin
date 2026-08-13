"use client"

import { useId, useRef } from "react"
import { gsap } from "gsap"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"
import { useGSAP } from "@gsap/react"
import { motion, useInView, useReducedMotion } from "motion/react"

gsap.registerPlugin(DrawSVGPlugin, useGSAP)

type Particle = {
  x: number
  y: number
  ox: number
  oy: number
  vx: number
  vy: number
  r: number
  a: number
}

export default function SecureAccess() {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shieldRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { amount: 0.35 })
  const inViewRef = useRef(inView)
  inViewRef.current = inView
  const reduce = useReducedMotion()
  const uid = useId()

  useGSAP(
    () => {
      const root = rootRef.current
      const canvas = canvasRef.current
      if (!root || !canvas) return

      const paths = root.querySelectorAll<SVGPathElement>(".shield-stroke")
      const fill = root.querySelector<SVGPathElement>(".shield-fill")

      if (!reduce) {
        gsap.fromTo(
          paths,
          { drawSVG: "0% 0%" },
          {
            drawSVG: "0% 100%",
            duration: 1.4,
            stagger: 0.12,
            ease: "power2.out",
          },
        )
        if (fill) {
          gsap.fromTo(
            fill,
            { scale: 0.86, transformOrigin: "50% 60%", opacity: 0.55 },
            {
              scale: 1,
              opacity: 1,
              duration: 1.8,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            },
          )
        }
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const pointer = { x: 0, y: 0, active: 0 }
      const xTo = gsap.quickTo(pointer, "x", { duration: 0.45, ease: "power3" })
      const yTo = gsap.quickTo(pointer, "y", { duration: 0.45, ease: "power3" })
      const activeTo = gsap.quickTo(pointer, "active", { duration: 0.35, ease: "power2.out" })

      let particles: Particle[] = []
      let raf = 0
      let running = false
      let color = "165 96% 71%"

      const readColor = () => {
        const raw = getComputedStyle(root).getPropertyValue("--primary").trim()
        if (raw) color = raw
      }

      const resize = () => {
        const rect = canvas.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.max(1, Math.floor(rect.width * dpr))
        canvas.height = Math.max(1, Math.floor(rect.height * dpr))
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const count = reduce ? 18 : 56
        particles = Array.from({ length: count }, () => {
          const x = Math.random() * rect.width
          const y = Math.random() * rect.height
          return {
            x,
            y,
            ox: x,
            oy: y,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            r: Math.random() * 1.6 + 0.6,
            a: Math.random() * 0.45 + 0.15,
          }
        })
        pointer.x = rect.width / 2
        pointer.y = rect.height / 2
      }

      const paint = (animateMotion: boolean) => {
        const { width, height } = canvas.getBoundingClientRect()
        ctx.clearRect(0, 0, width, height)

        for (const p of particles) {
          if (animateMotion) {
            const dx = pointer.x - p.x
            const dy = pointer.y - p.y
            const dist = Math.hypot(dx, dy) || 1
            const pull = pointer.active * Math.min(28 / dist, 1.6)
            p.vx += (dx / dist) * pull * 0.12
            p.vy += (dy / dist) * pull * 0.12
            p.vx += (p.ox - p.x) * 0.018
            p.vy += (p.oy - p.y) * 0.018
            p.vx *= 0.9
            p.vy *= 0.9
            p.x += p.vx
            p.y += p.vy
          }

          ctx.beginPath()
          ctx.fillStyle = `hsl(${color} / ${p.a + pointer.active * 0.2})`
          ctx.arc(p.x, p.y, p.r + pointer.active * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const draw = () => {
        if (!running) return
        if (inViewRef.current) paint(!reduce)
        raf = requestAnimationFrame(draw)
      }

      const onMove = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect()
        xTo(event.clientX - rect.left)
        yTo(event.clientY - rect.top)
        activeTo(1)
      }

      const onLeave = () => activeTo(0)

      resize()
      readColor()
      paint(false)
      running = true
      raf = requestAnimationFrame(draw)

      const ro = new ResizeObserver(resize)
      ro.observe(canvas)
      root.addEventListener("pointermove", onMove)
      root.addEventListener("pointerleave", onLeave)

      return () => {
        running = false
        cancelAnimationFrame(raf)
        ro.disconnect()
        root.removeEventListener("pointermove", onMove)
        root.removeEventListener("pointerleave", onLeave)
      }
    },
    { scope: rootRef, dependencies: [reduce] },
  )

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden"
      role="img"
      aria-label="Layered security shield with a private particle field"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(transparent_20%,var(--card)_72%)]" />
      <motion.div
        ref={shieldRef}
        className="absolute top-1/2 left-1/2 grid size-40 -translate-x-1/2 -translate-y-1/2 place-content-center bg-[radial-gradient(var(--card)_40%,transparent_90%)]"
        whileHover={reduce ? undefined : { scale: 1.06 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
      >
        <svg width="119" height="148" viewBox="0 0 119 148" fill="none" aria-hidden="true">
          <path
            className="shield-stroke"
            opacity="0.8"
            d="M117.725 81.2252C117.725 117.729 92.1721 135.981 61.8008 146.567C60.2104 147.106 58.4828 147.08 56.9092 146.494C26.4649 135.981 0.912109 117.729 0.912109 81.2252V30.1196C0.912109 28.1833 1.6813 26.3263 3.05047 24.9571C4.41963 23.588 6.27662 22.8188 8.21291 22.8188C22.8145 22.8188 41.0665 14.0578 53.7699 2.96059C55.3166 1.63914 57.2842 0.913086 59.3185 0.913086C61.3528 0.913086 63.3204 1.63914 64.8671 2.96059C77.6435 14.1308 95.8225 22.8188 110.424 22.8188C112.36 22.8188 114.217 23.588 115.587 24.9571C116.956 26.3263 117.725 28.1833 117.725 30.1196V81.2252Z"
            fill="hsl(var(--primary) / 0.1)"
            stroke={`url(#${uid}-g0)`}
            strokeWidth="1.8252"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="shield-stroke"
            opacity="0.8"
            d="M107.99 80.0097C107.99 110.43 86.6965 125.64 61.387 134.462C60.0617 134.911 58.6221 134.889 57.3108 134.401C31.9405 125.64 10.6465 110.43 10.6465 80.0097V37.4217C10.6465 35.8082 11.2875 34.2607 12.4284 33.1197C13.5694 31.9787 15.1169 31.3377 16.7305 31.3377C28.8985 31.3377 44.1085 24.0369 54.6946 14.7893C55.9836 13.6881 57.6232 13.083 59.3185 13.083C61.0138 13.083 62.6534 13.6881 63.9423 14.7893C74.5893 24.0978 89.7385 31.3377 101.906 31.3377C103.52 31.3377 105.068 31.9787 106.209 33.1197C107.349 34.2607 107.99 35.8082 107.99 37.4217V80.0097Z"
            fill="hsl(var(--primary) / 0.1)"
            stroke={`url(#${uid}-g1)`}
            strokeWidth="1.521"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="shield-stroke"
            opacity="0.6"
            d="M96.7589 78.6081C96.7589 102.008 80.3789 113.708 60.9101 120.494C59.8906 120.84 58.7832 120.823 57.7745 120.447C38.2589 113.708 21.8789 102.008 21.8789 78.6081V45.8481C21.8789 44.6069 22.372 43.4165 23.2496 42.5388C24.1273 41.6612 25.3177 41.1681 26.5589 41.1681C35.9189 41.1681 47.6189 35.5521 55.7621 28.4385C56.7536 27.5914 58.0148 27.126 59.3189 27.126C60.623 27.126 61.8842 27.5914 62.8757 28.4385C71.0657 35.5989 82.7189 41.1681 92.0789 41.1681C93.3201 41.1681 94.5105 41.6612 95.3882 42.5388C96.2658 43.4165 96.7589 44.6069 96.7589 45.8481V78.6081Z"
            fill="hsl(var(--primary) / 0.1)"
            stroke={`url(#${uid}-g2)`}
            strokeWidth="1.17"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="shield-fill"
            d="M84.2774 77.0499C84.2774 92.6499 73.3574 100.45 60.3782 104.974C59.6986 105.204 58.9603 105.193 58.2878 104.943C45.2774 100.45 34.3574 92.6499 34.3574 77.0499V55.2099C34.3574 54.3824 34.6861 53.5889 35.2712 53.0037C35.8564 52.4186 36.6499 52.0899 37.4774 52.0899C43.7174 52.0899 51.5174 48.3459 56.9462 43.6035C57.6072 43.0388 58.448 42.7285 59.3174 42.7285C60.1868 42.7285 61.0276 43.0388 61.6886 43.6035C67.1486 48.3771 74.9174 52.0899 81.1574 52.0899C81.9849 52.0899 82.7785 52.4186 83.3636 53.0037C83.9487 53.5889 84.2774 54.3824 84.2774 55.2099V77.0499Z"
            fill="hsl(var(--primary))"
          />
          <defs>
            <linearGradient id={`${uid}-g0`} x1="59.3185" y1="0.913" x2="59.3185" y2="146.954" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-g1`} x1="59.3185" y1="13.083" x2="59.3185" y2="134.783" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-g2`} x1="59.3189" y1="27.126" x2="59.3189" y2="120.742" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  )
}
