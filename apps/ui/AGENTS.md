# Orin UI — Agent Guide

Scope: **`apps/ui/` only.** This file guides agents building UI for the Orin collaborative coding platform.

---

## Core working rules

1. Make the smallest change that fully solves the requested problem.
2. Prefer straightforward, readable code over clever abstractions or broad refactors.
3. Change only files that are necessary for the task, and preserve established patterns unless they block the fix.
4. Do not make speculative cleanup, renames, dependency changes, or unrelated formatting edits.
5. Mention small, high-value performance or reliability improvements when noticed, but do not apply optional changes without approval.

---

## Stack at a glance

| Layer | Libraries / tools |
|-------|-------------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, `tw-animate-css`, CSS variables in `globals.css` |
| Components | shadcn/ui (New York), Radix UI primitives, CVA variants |
| Animation | Motion (`motion/react`), GSAP + `@gsap/react` for SVG/path work |
| Icons | Lucide React (`lucide-react`) |
| Theming | `next-themes` — dark default, class strategy |
| Auth | Clerk (`@clerk/nextjs`) |
| Data | tRPC + TanStack Query |
| IDE / AI UI | CodeMirror, xterm, WebContainer, `@xyflow/react`, custom `ai-elements/` |
| Toasts | Sonner (`@/components/ui/sonner`) |
| State | Zustand (`src/stores/`) |

### Path aliases

```ts
@/components  → src/components
@/components/ui  → shadcn primitives
@/lib/utils  → cn() helper
@/hooks  → custom hooks
```

### Key directories

```
src/
  app/                  # Next.js routes (page.tsx, layout.tsx, globals.css)
  components/
    ui/                 # shadcn/Radix primitives — reuse before creating new
    landing/            # Legacy landing components
    landing-latest/     # Current landing page sections
    ide-component/      # IDE shell (chat, terminal, preview)
    ai-elements/        # AI chat / agent UI building blocks
  hooks/                # Shared React hooks
  lib/                  # Utilities
  provider/             # ThemeProvider, etc.
  stores/               # Zustand stores
  trpc/                 # tRPC client/router
```

---

## Global UI conventions

1. **Reuse primitives** — Check `@/components/ui` and `@/components/ai-elements` before building from scratch.
2. **Use `cn()`** — Merge class names via `@/lib/utils` (`clsx` + `tailwind-merge`).
3. **Client vs server** — Add `"use client"` only when using hooks, browser APIs, or motion/GSAP. Keep pages and static sections as Server Components when possible.
4. **Design tokens** — Prefer semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`) over hard-coded colors.
5. **`data-slot` attributes** — shadcn components in this project use `data-slot="…"` for styling hooks; preserve them when extending.
6. **Dark-first** — Default theme is dark. Test new UI against `bg-background` / mint-green primary (`--primary: 165 96% 71%`).
7. **Icons** — Lucide at default `size-4`; match existing `[&_svg:not([class*='size-'])]:size-4` patterns in buttons.
8. **Responsive** — Mobile breakpoint aligns with `useIsMobile()` at **768px**. Use Tailwind `md:` / `lg:` consistently with landing sections (`max-w-[1320px]` content width).

---

## Design skills

Each section is a focused reference. Read the linked official docs for API details; follow these patterns in this codebase.

---

### 1. Motion (motion.dev)

**Docs:** [motion.dev/docs](https://motion.dev/docs) · Import: `import { motion, AnimatePresence } from "motion/react"`

Motion is the default animation library for React UI transitions, scroll reveals, and micro-interactions.

#### Do

- Mark animated components with `"use client"`.
- Reuse existing wrappers before inventing new ones:
  - `@/components/landing-latest/animated-section` — scroll-in sections (`whileInView`, `viewport={{ once: true }}`)
  - `@/components/landing/reveal` — fade-up on scroll
- Prefer **transform + opacity** (`y`, `scale`, `opacity`) — GPU-friendly, no layout thrash.
- Use **`whileInView`** for landing sections instead of animating on mount for below-the-fold content.
- Use **`AnimatePresence`** with **`mode="wait"`** when swapping mutually exclusive views (see `room/_ide-component.tsx`).
- Use **`layout`** / **`layoutId`** for shared-element transitions between list ↔ detail states.
- Respect reduced motion:

```tsx
import { motion, useReducedMotion } from "motion/react";

const prefersReducedMotion = useReducedMotion();

<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
/>
```

- Use **`motion.create()`** for polymorphic animated elements (see `ai-elements/shimmer.tsx`).

#### Don't

- Don't import from `framer-motion` — this project uses the **`motion`** package (`motion/react`).
- Don't animate `width`, `height`, `top`, `left` unless necessary — use `transform` and `layout`.
- Don't run infinite loops on large text blocks without pausing when off-screen.
- Don't skip `"use client"` on files using motion hooks.

#### Project easing defaults

Landing sections use ~**0.8s** duration with ease `[0.33, 1, 0.68, 1]` or `"easeOut"`. Match this for visual consistency on marketing pages.

---

### 2. Radix UI & shadcn primitives

**Docs:** [radix-ui.com](https://www.radix-ui.com/primitives/docs/overview/introduction) · [ui.shadcn.com](https://ui.shadcn.com/docs)

All interactive primitives live in `@/components/ui/`. They wrap Radix with Tailwind + CVA variants (New York style).

#### Do

- Compose from existing exports (`Dialog`, `DialogContent`, `Button`, `Sheet`, `Popover`, etc.).
- Use **`asChild`** + **`Slot`** (`@radix-ui/react-slot`) to render triggers/links as child elements without extra DOM.
- Always pair triggers with accessible labels — e.g. `<span className="sr-only">Close</span>` on icon-only close buttons.
- Use **`DialogTitle`** / **`DialogDescription`** (or Sheet/AlertDialog equivalents) for screen reader structure.
- Forward refs and spread `...props` onto the Radix primitive (follow `dialog.tsx` pattern).
- Use **`data-[state=open]:animate-in`** / **`data-[state=closed]:animate-out`** classes already wired in overlays (tw-animate-css).
- Extend via **`className={cn("…", className)}`** and CVA **`variants`** — don't fork entire components for one-off styles.

#### Don't

- Don't reimplement focus traps, portals, or escape-key handling — Radix handles this.
- Don't remove `data-slot` attributes when editing shadcn files.
- Don't use raw `<button>` for dialog triggers when `DialogTrigger asChild` + `Button` is the established pattern.
- Don't add new Radix packages without also adding a styled wrapper in `components/ui/`.

#### Adding new shadcn components

```bash
# From apps/ui/
npx shadcn@latest add <component>
```

Config: `components.json` (style: `new-york`, cssVariables: true, RSC: true).

---

### 3. Tailwind CSS v4 & design tokens

**Docs:** [tailwindcss.com/docs](https://tailwindcss.com/docs)

Tokens are defined in `src/app/globals.css` using `@theme inline` and HSL CSS variables.

#### Do

- Use semantic utilities: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`, `bg-primary`, `text-primary-foreground`.
- Use radius tokens: `rounded-md` maps to `--radius-md`; prefer `rounded-lg` / `rounded-xl` for cards.
- Reference CSS vars in inline SVG: `stroke="hsl(var(--foreground))"` with opacity modifiers.
- Use **`@custom-variant dark (&:is(.dark *))`** — dark mode is class-based via `next-themes`.
- Keep spacing aligned with landing layout: outer `px-6`, content `max-w-[1320px] mx-auto`, section gaps `mt-8 md:mt-16`.

#### Don't

- Don't hardcode hex colors that duplicate `--primary`, `--muted`, etc.
- Don't edit `tailwind.config` — Tailwind v4 here is CSS-first (`@import "tailwindcss"` in globals.css).
- Don't fight hidden scrollbars — global styles hide scrollbars; use `ScrollArea` when custom scroll UX is needed.

#### cn() pattern

```tsx
import { cn } from "@/lib/utils";

<div className={cn("base-classes", condition && "conditional", className)} />
```

---

### 4. GSAP (SVG & complex motion)

**Docs:** [gsap.com/docs](https://gsap.com/docs/) · [@gsap/react useGSAP](https://gsap.com/docs/v3/Plugins/React/)

Use GSAP for **SVG path following**, sequenced timelines, and illustrations — not for everyday button hovers (use Motion instead).

#### Do

- Register plugins once per module: `gsap.registerPlugin(MotionPathPlugin)`.
- Scope animations with **`useGSAP`** from `@gsap/react` and a **`scope` ref** on the container.
- Target SVG via class selectors inside the scoped SVG (see `landing/svg/bento-svg.tsx`, `landing-iso.tsx`).
- Set **`transformOrigin`** explicitly for rotation/scaling on SVG groups.
- Clean up is handled by `useGSAP` context when the component unmounts.

```tsx
"use client";
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export function SvgAnimation() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.to(".follower", { motionPath: { path: ".track", align: ".track", autoRotate: true }, duration: 4, repeat: -1 });
  }, { scope: container });

  return <div ref={container}>{/* inline SVG */}</div>;
}
```

#### Don't

- Don't use GSAP for simple fade/slide — Motion is lighter and already used in landing sections.
- Don't animate layout properties on large DOM trees with GSAP.
- Don't forget `"use client"` — GSAP touches the DOM.

#### Reduced motion

Wrap timelines in a `prefers-reduced-motion` check and skip or set `duration: 0`:

```tsx
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduced) gsap.to(/* … */);
```

---

### 5. Modern AI UI patterns (ai-elements)

**Inspiration:** [Vercel AI Elements](https://ai-sdk.dev/elements/overview), Magic UI / Aceternity-style effects (adapted to Orin tokens).

The `src/components/ai-elements/` directory holds chat, tool, canvas, and streaming UI. Treat it like an internal component library.

#### Do

- Compose chat UIs from `ai-elements/` exports (`message`, `conversation`, `prompt-input`, `tool`, `shimmer`, etc.).
- Use **`Shimmer`** for loading/streaming text states — it uses Motion + `bg-clip-text` with `--color-muted-foreground`.
- Use **`@xyflow/react`** primitives from `ai-elements/canvas`, `node`, `edge`, `controls` for agent/workflow graphs.
- Keep streaming UX accessible: announce new messages via semantic structure, not motion alone.
- Match IDE density — compact spacing, monospace via `font-mono` / `--font-geist-mono` where appropriate.

#### Don't

- Don't copy Magic UI/Aceternity components verbatim — adapt colors to Orin tokens and prefer existing `ui/` primitives.
- Don't add heavy blur/backdrop stacks on every message — performance matters in the IDE view.
- Don't duplicate `ai-elements` pieces in feature folders; extend the shared module.

#### Shimmer / gradient text pattern

Use CSS variables for theme compatibility:

```tsx
style={{
  backgroundImage: "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
} as CSSProperties}
```

---

### 6. Accessibility & inclusive design

**Docs:** [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) · [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)

#### Do

- Preserve Radix **`aria-*`** attributes and keyboard navigation (Tab, Escape, Arrow keys in menus).
- Provide **`sr-only`** text for icon-only controls.
- Ensure focus rings: `focus-visible:ring-ring/50 focus-visible:ring-[3px]` (already on Button).
- Honor **`prefers-reduced-motion`** for Motion and GSAP (see sections 1 & 4).
- Maintain **color contrast** on `muted-foreground` over `background` — primary mint on dark bg is the brand accent, not body text.
- Use semantic HTML in landing sections (`<section>`, `<main>`, heading hierarchy).

#### Don't

- Don't rely on color alone for state (pair with icons, labels, or `aria-invalid` on forms).
- Don't trap focus outside Radix dialogs — use the provided components.
- Don't autoplay distracting motion in the IDE workspace.

---

## Common tasks — quick recipes

### Scroll-reveal section (landing)

```tsx
import { AnimatedSection } from "@/components/landing-latest/animated-section";

<AnimatedSection className="mx-auto max-w-[1320px]" delay={0.1}>
  <MySection />
</AnimatedSection>
```

### Dialog

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

### Conditional motion

```tsx
"use client";
import { motion, useReducedMotion } from "motion/react";

export function FadeIn({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.4 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## Checklist before shipping UI

- [ ] Uses `@/components/ui` or `ai-elements` where applicable
- [ ] Semantic Tailwind tokens (no random hex values)
- [ ] `"use client"` only on interactive/animated leaf components
- [ ] Motion respects `useReducedMotion` (or uses static fallbacks)
- [ ] Keyboard + screen reader tested on dialogs/menus
- [ ] Responsive at 768px breakpoint
- [ ] Dark theme verified (default)

---

## Official reference links

| Topic | URL |
|-------|-----|
| Motion | https://motion.dev/docs |
| Radix Primitives | https://www.radix-ui.com/primitives/docs/overview/introduction |
| shadcn/ui | https://ui.shadcn.com/docs |
| Tailwind CSS v4 | https://tailwindcss.com/docs |
| GSAP | https://gsap.com/docs/ |
| GSAP React | https://gsap.com/docs/v3/Plugins/React/ |
| XYFlow | https://reactflow.dev/learn |
| Lucide Icons | https://lucide.dev/icons/ |
| next-themes | https://github.com/pacocoursey/next-themes |
