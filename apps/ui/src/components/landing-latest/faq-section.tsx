"use client"

import type React from "react"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const faqData = [
  {
    question: "What is Orin?",
    answer:
      "Orin is a browser-based AI coding workspace. Start or generate a React + Vite project, edit files, run commands, preview the app, and continue working in the same project room.",
  },
  {
    question: "How does project generation work?",
    answer:
      "Enter a plain-language prompt from the landing page or workspace. After the project boots, Orin sends the prompt to your configured AI provider and applies the generated file changes to the project tree.",
  },
  {
    question: "Which AI providers can I use?",
    answer:
      "Settings supports OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, and a local OpenAI-compatible server such as Ollama. You can save a provider key and choose a model override.",
  },
  {
    question: "Where are my projects saved?",
    answer:
      "Projects are saved through the Orin backend, with browser storage available as a fallback. The workspace keeps up to five recent projects, and you can reopen or delete them from the project home.",
  },
  {
    question: "How do editing and live preview work?",
    answer:
      "The project runs in a browser-based WebContainer. Use the Explorer and code editor to change files, the terminal to run commands, and Preview to see the app with desktop, tablet, or mobile sizing.",
  },
  {
    question: "Can I work with someone else?",
    answer:
      "Open the Peer tab inside a project room when the collaboration service is available. You can chat, share files, and connect with another person while the room keeps code changes synchronized.",
  },
  {
    question: "Can I export a project to GitHub?",
    answer:
      "Yes. Use Export in the workspace, provide a GitHub Personal Access Token, and Orin will create a repository and upload the current project files.",
  },
]

interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

const FAQItem = ({ question, answer, isOpen, onToggle }: FAQItemProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onToggle()
  }
  return (
    <div
      className={`w-full bg-[rgba(231,236,235,0.08)] shadow-[0px_2px_4px_rgba(0,0,0,0.16)] overflow-hidden rounded-[10px] outline outline-1 outline-border outline-offset-[-1px] transition-all duration-500 ease-out cursor-pointer`}
      onClick={handleClick}
    >
      <div className="w-full px-5 py-[18px] pr-4 flex justify-between items-center gap-5 text-left transition-all duration-300 ease-out">
        <div className="flex-1 text-foreground text-base font-medium leading-6 break-words">{question}</div>
        <div className="flex justify-center items-center">
          <ChevronDown
            className={`w-6 h-6 text-muted-foreground-dark transition-all duration-500 ease-out ${isOpen ? "rotate-180 scale-110" : "rotate-0 scale-100"}`}
          />
        </div>
      </div>
      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
        style={{
          transitionProperty: "max-height, opacity, padding",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          className={`px-5 transition-all duration-500 ease-out ${isOpen ? "pb-[18px] pt-2 translate-y-0" : "pb-0 pt-0 -translate-y-2"}`}
        >
          <div className="text-foreground/80 text-sm font-normal leading-6 break-words">{answer}</div>
        </div>
      </div>
    </div>
  )
}

export function FAQSection() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems)
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index)
    } else {
      newOpenItems.add(index)
    }
    setOpenItems(newOpenItems)
  }
  return (
    <section className="w-full pt-[66px] pb-20 md:pb-40 px-5 relative flex flex-col justify-center items-center">
      <div className="w-[300px] h-[500px] absolute top-[150px] left-1/2 -translate-x-1/2 origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[100px] z-0" />
      <div className="self-stretch pt-8 pb-8 md:pt-14 md:pb-14 flex flex-col justify-center items-center gap-2 relative z-10">
        <div className="flex flex-col justify-start items-center gap-4">
          <h2 className="w-full max-w-[435px] text-center text-foreground text-4xl font-semibold leading-10 break-words">
            Questions about the workspace
          </h2>
          <p className="self-stretch text-center text-muted-foreground text-sm font-medium leading-[18.20px] break-words">
            A few details about projects, AI providers, rooms, and the browser-based development environment
          </p>
        </div>
      </div>
      <div className="w-full max-w-[600px] pt-0.5 pb-10 flex flex-col justify-start items-start gap-4 relative z-10">
        {faqData.map((faq, index) => (
          <FAQItem key={index} {...faq} isOpen={openItems.has(index)} onToggle={() => toggleItem(index)} />
        ))}
      </div>
    </section>
  )
}
