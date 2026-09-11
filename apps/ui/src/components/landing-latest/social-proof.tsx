"use client"

import Image from "next/image"
import {
  Code2,
  Eye,
  Github,
  MessageSquareText,
  Sparkles,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const flowSteps = [
  { label: "Prompt", detail: "Describe it", icon: MessageSquareText },
  { label: "Generate", detail: "Create the files", icon: Sparkles },
  { label: "Edit", detail: "Shape the code", icon: Code2 },
  { label: "Preview", detail: "Watch it run", icon: Eye },
  { label: "Ship", detail: "Export to GitHub", icon: Github },
]

export function SocialProof() {
  const reduce = useReducedMotion()

  return (
    <section className="relative self-stretch overflow-hidden px-2 py-14 md:py-20">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.04) 42%, transparent 72%)",
        }}
      />

      <div className="relative mx-auto mt-10 max-w-[1120px] md:mt-16">
        <div className="flex items-center justify-center gap-3 text-center">
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />
          <p className="text-sm font-medium text-muted-foreground">From first prompt to shipped code</p>
          <span className="size-1.5 rounded-full bg-primary/40" />
        </div>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-6 text-muted-foreground/70">
          Every part of the build loop stays connected inside your Orin workspace.
        </p>

        <div className="relative mt-9 overflow-hidden rounded-[28px] border border-border/80 bg-card/60 shadow-[0_24px_80px_hsl(var(--background)/0.45)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground) / 0.035) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.035) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "linear-gradient(to bottom, black, transparent 88%)",
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

          <div className="relative flex flex-col items-center px-5 py-8 sm:px-8 md:px-12 md:py-10">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_10px_hsl(var(--primary)/0.08)]"
                animate={
                  reduce
                    ? undefined
                    : {
                        boxShadow: [
                          "0 0 8px hsl(var(--primary) / 0.06)",
                          "0 0 14px hsl(var(--primary) / 0.12)",
                          "0 0 8px hsl(var(--primary) / 0.06)",
                        ],
                      }
                }
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image src="/Orin-logo.svg" alt="Orin" width={28} height={28} className="size-7" />
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary shadow-[0_0_4px_hsl(var(--primary)/0.45)]" />
              </motion.div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Orin workspace</p>
                <p className="mt-0.5 text-xs text-muted-foreground">One connected build loop</p>
              </div>
            </div>

            <div className="relative mt-9 w-full">
              <div className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 md:block" />
              <motion.div
                className="absolute left-[10%] top-[25px] hidden size-1.5 rounded-full bg-primary shadow-[0_0_16px_4px_hsl(var(--primary)/0.55)] md:block"
                animate={reduce ? undefined : { left: ["10%", "90%"] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
              />

              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-5 md:gap-0">
                {flowSteps.map((step) => {
                  const Icon = step.icon

                  return (
                    <motion.div
                      key={step.label}
                      className="group relative flex flex-col items-center text-center"
                      whileHover={reduce ? undefined : { y: -4 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="relative flex size-14 items-center justify-center rounded-2xl border border-border bg-background/90 text-muted-foreground shadow-[0_10px_26px_hsl(var(--background)/0.35)] transition-colors duration-200 group-hover:border-primary/40 group-hover:text-primary">
                        <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm font-medium text-foreground">{step.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
