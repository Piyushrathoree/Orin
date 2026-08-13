"use client";

import React, { useState } from "react";
import {
  motion,
  useScroll,
  useMotionValueEvent,
  type Variants,
} from "motion/react";
import { SignedIn, SignedOut, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";

// --- Animation Variants ---
const cardVariants: Variants = {
  closed: { opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.15 } },
  open: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

const linkVariants: Variants = {
  closed: { y: 4, opacity: 0 },
  open: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { duration: 0.2, delay: i * 0.02 },
  }),
};

// --- Links Data ---
const mainLinks = [
  { href: "#hero", label: "Overview" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

const subLinks = [
  { href: "/docs", label: "Documentation" },
  { href: "/changelog", label: "Changelog" },
  { href: "/blog", label: "Blog" },
  { href: "#faq", label: "FAQs" },
];

const socialLinks = [
  { href: "https://x.com/orin", label: "Twitter" },
  { href: "https://github.com/orin", label: "GitHub" },
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed w-full top-0 left-0 right-0 z-50 px-2 sm:px-6 md:px-8 lg:px-12 pt-4 sm:pt-6"
    >
      <div 
        className={`max-w-screen-2xl mx-auto flex justify-between items-center py-3 px-4 sm:py-4 sm:px-6 rounded-2xl sm:rounded-3xl border transition-all duration-300 ${
          isScrolled 
            ? "bg-black/80 border-white/10 backdrop-blur-xl shadow-2xl" 
            : "bg-transparent border-transparent"
        }`}
      >
        <Link href="/" className="flex items-center gap-1 group">
          <Image src="/Orin-logo.svg" alt="Orin logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" priority />
          <span className="text-white text-xl hidden sm:block">Orin</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {mainLinks.map(link => (
            <a key={link.label} href={link.href} className="text-sm text-zinc-400 hover:text-white transition-colors">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <SignedOut>
            <Link href="/sign-in" className="text-sm text-zinc-400 hover:text-white transition-colors mr-2">
              Login
            </Link>
            <Link href="/sign-up" className="bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-medium px-4 py-2 transition-all rounded-none">
              Join Now
            </Link>
          </SignedOut>
          <SignedIn>
           
            <SignOutButton>
              <Button className="text-xs bg-orange-600 hover:bg-orange-700 text-white ml-2 transition-colors cursor-pointer border border-white/5 px-4 py-2">
                Logout
              </Button>
            </SignOutButton>
          </SignedIn>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
