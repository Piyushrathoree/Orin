"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ComponentType } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import SecureAccess from "./bento/secure-access"
import OneFlowProcess from "./bento/one-flow-process"
import PickYourTool from "./bento/pick-your-tool"
import BuildPrompt from "./bento/build-prompt"
import VoiceAssistant from "./bento/voice-assistant"

type BentoCardProps = {
  title: string
  description: string
  Component: ComponentType
  className?: string
  visualClassName?: string
}

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.33, 1, 0.68, 1] as const },
  },
}

function BentoCard({ title, description, Component, className, visualClassName }: BentoCardProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      variants={cardVariants}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("h-full", className)}
    >
      <Card className="group/card flex h-full flex-col gap-0 overflow-hidden rounded-xl border-border/80 bg-card py-0 shadow-none ring-0 transition-colors duration-200 hover:border-border">
        <div className={cn("relative h-60 overflow-hidden", visualClassName)}>
          <Component />
        </div>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-2xl font-semibold">{title}</h3>
          <p className="text-muted-foreground text-lg">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function BentoSection() {
  const reduce = useReducedMotion()
  const cards: BentoCardProps[] = [
    {
      title: "Secure access",
      description: "Your information stays encrypted and private, ensuring complete safety while using our AI platform.",
      Component: SecureAccess,
    },
    {
      title: "One-flow process",
      description: "Conduct deep research seamlessly in a single process, reducing complexity and saving valuable time.",
      Component: OneFlowProcess,
    },
    {
      title: "Pick your tool",
      description: "Select from a range of leading AI tools and customize your workspace the way you prefer.",
      Component: PickYourTool,
      className: "max-lg:order-1",
    },
    {
      title: "Build things with simple prompt",
      description: "Turn simple text prompts into powerful outputs, from design to analysis, without extra effort.",
      Component: BuildPrompt,
      className: "sm:col-span-2",
      visualClassName: "min-h-60 sm:h-72",
    },
    {
      title: "Voice assistant",
      description: "Ask, command, and get instant responses.",
      Component: VoiceAssistant,
      className: "max-lg:order-1",
    },
  ]

  return (
    <section className="w-full px-5 flex flex-col justify-center items-center overflow-visible bg-transparent">
      <div className="w-full py-8 md:py-16 relative flex flex-col justify-start items-start gap-6">
        <div className="w-[547px] h-[938px] absolute top-[614px] left-[80px] origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[130px] z-0" />
        <div className="self-stretch py-8 md:py-14 flex flex-col justify-center items-center gap-2 z-10">
          <div className="flex flex-col justify-start items-center gap-4">
            <h2 className="w-full max-w-[655px] text-center text-foreground text-4xl md:text-6xl font-semibold leading-tight md:leading-[66px]">
              Empower Your Workflow with AI
            </h2>
            <p className="w-full max-w-[600px] text-center text-muted-foreground text-lg md:text-xl font-medium leading-relaxed">
              Ask your AI Agent for real-time collaboration, seamless integrations, and actionable insights to
              streamline your operations.
            </p>
          </div>
        </div>
        <motion.div
          className="z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          variants={reduce ? undefined : containerVariants}
          initial={reduce ? false : "hidden"}
          whileInView={reduce ? undefined : "show"}
          viewport={{ once: true, amount: 0.15 }}
        >
          {cards.map((card) => (
            <BentoCard key={card.title} {...card} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
