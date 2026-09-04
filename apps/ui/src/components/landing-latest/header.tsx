"use client"

import type React from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

function AuthCta({ className }: { className?: string }) {
  const buttonClass = [
    "bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full px-6 py-2 font-medium shadow-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <Button asChild className={buttonClass}>
      <Link href="/main">Open workspace</Link>
    </Button>
  )
}

export function Header() {
  const navItems = [
    { name: "Features", href: "#features-section" },
    { name: "Pricing", href: "#pricing-section" },
    { name: "Testimonials", href: "#testimonials-section" }, // Changed from Docs to Testimonials
  ]

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const targetId = href.substring(1) // Remove '#' from href
    const targetElement = document.getElementById(targetId)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <header className="w-full py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            <Image
              src="/Orin-logo.svg"
              alt="Orin logo"
              width={32}
              height={32}
              className="invert dark:invert-0"
              priority
            />
            <span className="text-foreground text-xl font-semibold">Orin</span>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={(e) => handleScroll(e, item.href)}
                className="rounded-full px-4 py-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden md:inline-flex" />
          <AuthCta className="hidden md:inline-flex" />
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-7 w-7" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-background border-t border-border text-foreground">
              <SheetHeader>
                <SheetTitle className="text-left text-xl font-semibold text-foreground">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={(e) => handleScroll(e, item.href)}
                    className="justify-start py-2 text-lg text-muted-foreground hover:text-foreground"
                  >
                    {item.name}
                  </Link>
                ))}
                <AuthCta className="mt-4 w-full" />
                <ThemeToggle className="mt-2 self-start" />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
