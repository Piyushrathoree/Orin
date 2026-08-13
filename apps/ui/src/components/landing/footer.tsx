"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Github, Twitter, MessageCircle, ArrowUpRight, Mail, MessageSquare } from "lucide-react";
import OrangeButton from "./button/orange-button";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#features" },
        { name: "Workspace", href: "#workspace" },
        { name: "Real-time Sync", href: "#collab" },
        { name: "Pricing", href: "#pricing" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "/docs" },
        { name: "Changelog", href: "/changelog" },
        { name: "Support", href: "mailto:support@orin.com" },
        { name: "API Reference", href: "/api-docs" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About", href: "/about" },
        { name: "Blog", href: "/blog" },
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms of Service", href: "/terms" },
      ],
    },
  ];

  const socialLinks = [
    { name: "Twitter", icon: <Twitter size={18} />, href: "https://twitter.com/orin" },
    { name: "GitHub", icon: <Github size={18} />, href: "https://github.com/orin" },
    { name: "Discord", icon: <MessageCircle size={18} />, href: "https://discord.gg/orin" },
  ];

  return (
    <footer className="relative w-full bg-black border-zinc-900 pt-20 pb-10 overflow-hidden">
    
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Main Links Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 py-20">
          {/* Brand Info */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-1 mb-6">
              <Image src="/Orin-logo.svg" alt="Orin logo" width={32} height={32} className="h-8 w-8" />
              <span className="text-white font-bold text-xl tracking-tight">
                Orin
              </span>
            </Link>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">
              The collaborative AI workspace built for modern software teams.
              Code, review, and deploy in one unified environment.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-orange-500 hover:border-orange-500/50 transition-all"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-white font-semibold mb-6">{group.title}</h3>
              <ul className="space-y-4">
                {group.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-zinc-500 hover:text-white transition-colors text-sm flex items-center gap-1 group"
                    >
                      {link.name}
                      {link.href.startsWith("http") && (
                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-900/50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-zinc-500 text-sm">
            © {currentYear} Orin Inc. All rights reserved.
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
