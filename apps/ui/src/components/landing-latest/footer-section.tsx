"use client"

import Image from "next/image"

type SocialPlatform = "X" | "GitHub" | "LinkedIn"

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  const paths = {
    X: "M18.244 2.25h3.308l-7.227 8.26L22.83 21h-6.657l-5.214-6.817L4.99 21H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 16.767h1.833L7.084 4.126H5.117l11.966 14.891Z",
    GitHub: "M12 2C6.477 2 2 6.586 2 12.244c0 4.524 2.865 8.362 6.839 9.716.5.096.683-.223.683-.496 0-.244-.009-1.053-.014-1.91-2.782.62-3.369-1.21-3.369-1.21-.455-1.183-1.11-1.498-1.11-1.498-.908-.64.069-.627.069-.627 1.004.072 1.532 1.056 1.532 1.056.892 1.566 2.341 1.114 2.91.852.091-.666.349-1.114.635-1.37-2.221-.261-4.556-1.14-4.556-5.073 0-1.12.39-2.034 1.03-2.752-.104-.261-.447-1.312.098-2.735 0 0 .84-.276 2.75 1.051A9.286 9.286 0 0 1 12 6.69c.85.004 1.706.119 2.505.35 1.91-1.326 2.749-1.051 2.749-1.051.546 1.423.203 2.474.1 2.735.64.718 1.028 1.632 1.028 2.752 0 3.943-2.34 4.809-4.568 5.065.359.32.678.947.678 1.91 0 1.38-.012 2.492-.012 2.83 0 .276.18.597.688.495C19.14 20.603 22 16.766 22 12.244 22 6.586 17.523 2 12 2Z",
    LinkedIn: "M5.37 3.5a1.87 1.87 0 1 1 0 3.74 1.87 1.87 0 0 1 0-3.74ZM3.75 8.65h3.24V20.5H3.75V8.65Zm5.27 0h3.1v1.62h.04c.43-.82 1.49-1.69 3.07-1.69 3.28 0 3.89 2.16 3.89 4.97v6.95h-3.23v-6.16c0-1.47-.03-3.36-2.05-3.36-2.05 0-2.36 1.6-2.36 3.25v6.27H9.02V8.65Z",
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-full w-full fill-current text-muted-foreground"
    >
      <path d={paths[platform]} />
    </svg>
  )
}

export function FooterSection() {
  return (
    <footer className="w-full max-w-[1320px] mx-auto px-5 flex flex-col md:flex-row justify-between items-start gap-8 md:gap-0 py-10 md:py-[70px]">
      {/* Left Section: Logo, Description, Social Links */}
      <div className="flex flex-col justify-start items-start gap-8 p-4 md:p-8">
        <div className="flex gap-1 items-stretch justify-center">
          <Image src="/Orin-logo.svg" alt="Orin logo" width={32} height={32} />
          <div className="text-center text-foreground text-xl font-semibold leading-4 self-center">Orin</div>
        </div>
        <p className="text-foreground/90 text-sm font-medium leading-[18px] text-left">Coding made effortless</p>
        <div className="flex justify-start items-start gap-3">
          <a href="https://x.com/orin" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="w-4 h-4 flex items-center justify-center">
            <SocialIcon platform="X" />
          </a>
          <a href="https://github.com/orin" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="w-4 h-4 flex items-center justify-center">
            <SocialIcon platform="GitHub" />
          </a>
          <a href="https://www.linkedin.com/company/orin" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-4 h-4 flex items-center justify-center">
            <SocialIcon platform="LinkedIn" />
          </a>
        </div>
      </div>
      {/* Right Section: Product, Company, Resources */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 p-4 md:p-8 w-full md:w-auto">
        <div className="flex flex-col justify-start items-start gap-3">
          <h3 className="text-muted-foreground text-sm font-medium leading-5">Product</h3>
          <div className="flex flex-col justify-end items-start gap-2">
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Features
            </a>
            <a href="#pricing-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Pricing
            </a>
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Integrations
            </a>
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Real-time Previews
            </a>
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Multi-Agent Coding
            </a>
          </div>
        </div>
        <div className="flex flex-col justify-start items-start gap-3">
          <h3 className="text-muted-foreground text-sm font-medium leading-5">Company</h3>
          <div className="flex flex-col justify-center items-start gap-2">
            <a href="#testimonials-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              About us
            </a>
            <a href="#testimonials-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Our team
            </a>
            <a href="#faq-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Careers
            </a>
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Brand
            </a>
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Contact
            </a>
          </div>
        </div>
        <div className="flex flex-col justify-start items-start gap-3">
          <h3 className="text-muted-foreground text-sm font-medium leading-5">Resources</h3>
          <div className="flex flex-col justify-center items-start gap-2">
            <a href="#features-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Terms of use
            </a>
            <a href="#testimonials-section" className="text-foreground text-sm font-normal leading-5 hover:underline">
              API Reference
            </a>
            <a href="mailto:hello@orin.dev" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Documentation
            </a>
            <a href="mailto:hello@orin.dev" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Community
            </a>
            <a href="mailto:hello@orin.dev" className="text-foreground text-sm font-normal leading-5 hover:underline">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
