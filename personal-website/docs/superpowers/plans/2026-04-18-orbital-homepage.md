# Orbital Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `Carousel3D` rotating-cards homepage with a physics-driven planetary orbit scene that reads as artwork, per `docs/superpowers/specs/2026-04-18-orbital-homepage-design.md`.

**Architecture:** A new `OrbitalScene` component renders a central star, SVG orbit rings, and five billboarded planet divs whose 2D positions are computed every frame from a JS orbital-mechanics loop (3D position on a tilted plane, projected to screen with scale/opacity as depth cues). A `SideIndex` component and an `OrbitalHero` wrapper compose the homepage layout. Fonts are loaded via `next/font/google`; palette + atmosphere live in `app/globals.css`.

**Tech Stack:** Next.js 16 (App Router, webpack dev), React 19, TypeScript 5, Tailwind v4 (already present but used sparingly — most new styling goes in `globals.css` / scoped classnames), `next/font/google`. No new runtime deps.

**Testing note:** This repo has no unit-test harness (no Jest/Vitest in `package.json`). Verification in each task relies on: (1) TypeScript type-checking via `npx tsc --noEmit`, (2) ESLint via `npm run lint`, (3) visual smoke-checks against `npm run dev` at `http://localhost:3000`. Introducing a test framework is out of scope.

**Reference implementation:** `.superpowers/brainstorm/47689-1776549507/content/orbital-v3.html` — this is the working HTML/CSS/JS prototype that the components port from.

**Section-id mapping note:** The existing `ContentPanel` uses section id `blog`. The spec uses `writing`. To preserve routing without changes, the new components use id `blog` internally (so `ContentPanel` keeps working) but display the label **Writing**. All five ids: `home`, `about`, `projects`, `blog`, `contact`.

---

## File Structure

- Create: `lib/orbitalData.ts` — `PLANETS` constant (orbital parameters + display metadata)
- Create: `components/OrbitalScene.tsx` — scene renderer + rAF loop
- Create: `components/SideIndex.tsx` — Roman-numeral vertical index
- Create: `components/OrbitalHero.tsx` — hero wrapper: title + scene + index + metadata strip
- Modify: `app/layout.tsx` — load fonts via `next/font/google`, bind to CSS variables, drop the Fontshare `<link>`
- Modify: `app/globals.css` — add orbital palette CSS vars, `.orbital-*` atmosphere styles (sky / grain / stars), and the hero grid / scene / index / body styles
- Modify: `app/page.tsx` — replace `<Carousel3D>` usage with `<OrbitalHero>`; remove `<SceneRing>` from the homepage
- Delete: `components/Carousel3D.tsx`
- Delete: `components/HomeHero.tsx` (existing file is unused by `app/page.tsx` — only self-referenced in README; replacing its role with `OrbitalHero`)

Files deliberately untouched: `ContentPanel`, `Modal`, `ThemeBar`, `VisitorCount`, `NavBar`, `SceneRing` (it may still be used on other pages — we only remove its usage from `app/page.tsx`), all under `components/Terminal/**`.

---

## Task 1: Load Cormorant Garamond + IBM Plex Sans + IBM Plex Mono via `next/font/google`

**Files:**

- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the Fontshare `<link>` with `next/font/google` imports**

Open `app/layout.tsx` and replace the current contents with the version below. Key changes:

- Add `import { Cormorant_Garamond, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';`
- Configure each font with the weights/styles the spec requires and expose them as CSS variables (`--font-display`, `--font-sans`, `--font-mono`).
- Apply all three variable classes to `<html>` so CSS in `globals.css` can reference them.
- Remove the `<link rel="stylesheet" href="https://api.fontshare.com/...">` (Clash Display / Satoshi are no longer used).
- Keep the preconnect to `fonts.bunny.net`? No — drop it, we're not using Bunny. Keep the dev-only `react-grab` scripts and the theme-init inline script unchanged.

```tsx
import type { Metadata } from 'next';
import Script from 'next/script';
import {
  Cormorant_Garamond,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
} from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tylerxiao.com',
  ),
  title: "Tyler Xiao's Portfolio",
  description:
    "Personal portfolio for Tyler Xiao — UCLA CS '27 focused on agentic AI, backend systems, and trust & safety automation.",
  openGraph: {
    title: "Tyler Xiao's Portfolio",
    description:
      "Explore Tyler Xiao's experience, projects, and ways to collaborate on AI agents and backend systems.",
    siteName: 'Tyler Xiao',
    images: [
      {
        url: '/lordboba.png',
        width: 1200,
        height: 1200,
        alt: 'Tyler Xiao avatar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Tyler Xiao's Portfolio",
    description:
      "Explore Tyler Xiao's experience, projects, and ways to collaborate on AI agents and backend systems.",
    images: ['/lordboba.png'],
  },
  icons: {
    icon: [
      { rel: 'icon', url: '/icon.png' },
      { rel: 'apple-touch-icon', url: '/icon.png' },
      { rel: 'shortcut icon', url: '/icon.png' },
    ],
  },
};

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    var ct = localStorage.getItem('color-theme');
    if (ct) {
      document.documentElement.setAttribute('data-color-theme', ct);
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/@react-grab/mcp/dist/client.global.js"
            strategy="lazyOnload"
          />
        )}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground">
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Typecheck + build sanity**

Run: `npx tsc --noEmit`
Expected: exits 0 with no errors.

Run: `npm run lint`
Expected: exits 0 (warnings about the existing codebase are fine, but `layout.tsx` must have no new errors).

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "Load orbital typefaces via next/font/google"
```

---

## Task 2: Add orbital palette + atmosphere variables to `globals.css`

**Files:**

- Modify: `app/globals.css` (append a new `/* === Orbital homepage === */` section at the end; do NOT touch existing variables/rules, other pages depend on them)

- [ ] **Step 1: Append orbital palette variables under `:root`**

Open `app/globals.css`, scroll to the end, and add the block below as a **new top-level section** (not inside any existing `@layer` or selector unless stated). All new class names are prefixed `orb-` to avoid collisions with the existing carousel CSS.

```css
/* === Orbital homepage =================================================== */
:root {
  --orb-ink: #0a0614;
  --orb-deep: #14082a;
  --orb-dusk: #2a1f4a;
  --orb-violet: #4c3388;
  --orb-wine: #6b2a5a;
  --orb-ember: #f2c79e;
  --orb-flame: #e89b74;
  --orb-peach: #f7dcc0;
  --orb-paper: #fff5ea;

  --orb-haze: rgba(247, 220, 192, 0.78);
  --orb-whisper: rgba(247, 220, 192, 0.48);
  --orb-hairline: rgba(247, 220, 192, 0.18);
  --orb-hairline-s: rgba(247, 220, 192, 0.08);

  --orb-display: var(--font-display), 'EB Garamond', Georgia, serif;
  --orb-sans: var(--font-sans), system-ui, sans-serif;
  --orb-mono: var(--font-mono), ui-monospace, Menlo, monospace;

  --orb-scene: 700px;
}

/* Atmosphere layers — siblings of .app-shell, fixed to viewport */
.orb-sky {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(
      44% 36% at 20% 10%,
      rgba(242, 199, 158, 0.35) 0%,
      transparent 70%
    ),
    radial-gradient(
      28% 24% at 82% 14%,
      rgba(232, 155, 116, 0.3) 0%,
      transparent 72%
    ),
    radial-gradient(
      58% 55% at 70% 112%,
      rgba(76, 51, 136, 0.7) 0%,
      transparent 55%
    ),
    radial-gradient(
      58% 50% at 10% 118%,
      rgba(107, 42, 90, 0.42) 0%,
      transparent 60%
    ),
    linear-gradient(180deg, #241742 0%, #14082a 48%, #0a0614 100%);
  animation: orb-drift 40s ease-in-out infinite alternate;
}
@keyframes orb-drift {
  from {
    filter: hue-rotate(0deg);
  }
  to {
    filter: hue-rotate(-6deg);
  }
}

.orb-stars {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.orb-stars > i {
  position: absolute;
  border-radius: 50%;
  background: var(--orb-paper);
  box-shadow: 0 0 6px rgba(255, 245, 234, 0.75);
  animation: orb-twinkle 5s ease-in-out infinite;
}
@keyframes orb-twinkle {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.8);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.2);
  }
}

.orb-grain {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.1;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  background-size: 200px;
}

/* Hero shell — overrides the generic .app-main stacking for the homepage */
.orb-shell {
  position: relative;
  z-index: 3;
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  color: var(--orb-paper);
  font-family: var(--orb-sans);
}

.orb-stage {
  display: grid;
  grid-template-columns: 1fr var(--orb-scene) 260px 1fr;
  grid-template-rows: auto auto;
  column-gap: 36px;
  row-gap: 10px;
  align-items: center;
  padding: 0 32px 16px;
}

.orb-title {
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  text-align: center;
  animation: orb-rise 1.1s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.orb-title .eye {
  font-family: var(--orb-mono);
  font-size: 10.5px;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: var(--orb-ember);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.orb-title .eye::before,
.orb-title .eye::after {
  content: '';
  width: 22px;
  height: 1px;
  background: currentColor;
  opacity: 0.7;
}
.orb-title h1 {
  font-family: var(--orb-display);
  font-weight: 300;
  font-size: 68px;
  line-height: 0.95;
  letter-spacing: -0.008em;
  color: var(--orb-paper);
  text-shadow: 0 4px 28px rgba(0, 0, 0, 0.3);
}
.orb-title h1 em {
  font-style: italic;
  font-weight: 300;
  color: var(--orb-ember);
}

/* Scene container — 2D, no 3D transforms */
.orb-scene {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  width: var(--orb-scene);
  height: var(--orb-scene);
  justify-self: center;
  position: relative;
}

.orb-star {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 84px;
  height: 84px;
  margin: -42px 0 0 -42px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 34% 32%,
    #fff5ea 0%,
    #f2c79e 30%,
    #e89b74 62%,
    #8f4b3f 100%
  );
  box-shadow:
    0 0 60px rgba(242, 199, 158, 0.7),
    0 0 180px rgba(232, 155, 116, 0.45),
    0 0 360px 20px rgba(232, 155, 116, 0.22);
  animation: orb-breathe 4.6s ease-in-out infinite;
  z-index: 500;
}
.orb-star::before {
  content: '';
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 245, 234, 0.45) 0%,
    transparent 62%
  );
  filter: blur(6px);
  animation: orb-corona 6s ease-in-out infinite;
}
.orb-star::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 220px;
  height: 220px;
  margin: -110px 0 0 -110px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(242, 199, 158, 0.18) 0%,
    transparent 60%
  );
  filter: blur(12px);
  pointer-events: none;
}
@keyframes orb-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
@keyframes orb-corona {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

.orb-rings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.orb-rings ellipse {
  fill: none;
  stroke: var(--orb-hairline-s);
  stroke-width: 1;
}
.orb-rings ellipse.orb-ring-bright {
  stroke: rgba(242, 199, 158, 0.42);
  stroke-width: 1.2;
}

/* Bodies — each .orb-body is positioned per frame by JS */
.orb-bodies {
  position: absolute;
  inset: 0;
}
.orb-body {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  cursor: pointer;
  will-change: transform, opacity;
  transition: filter 0.3s;
  background: none;
  border: 0;
  padding: 0;
}
.orb-body .orb-planet {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.orb-body:hover .orb-planet {
  transform: translate(-50%, -50%) scale(1.15);
}

.orb-planet.kind-home {
  width: 26px;
  height: 26px;
  background: radial-gradient(
    circle at 32% 30%,
    #fff5ea 0%,
    #f2c79e 35%,
    #d07f5a 85%
  );
  box-shadow: 0 0 18px rgba(242, 199, 158, 0.55);
}
.orb-planet.kind-about {
  width: 38px;
  height: 38px;
  background: radial-gradient(
    circle at 32% 30%,
    #f7dcc0 0%,
    #c98b7a 42%,
    #5a2a6b 94%
  );
  box-shadow:
    inset -8px -5px 12px rgba(0, 0, 0, 0.45),
    0 0 14px rgba(201, 139, 122, 0.25);
}
.orb-planet.kind-projects {
  width: 54px;
  height: 54px;
  background: radial-gradient(
    circle at 30% 28%,
    #f2c79e 0%,
    #a0648c 42%,
    #3b2266 94%
  );
  box-shadow:
    inset -12px -8px 18px rgba(0, 0, 0, 0.55),
    0 0 22px rgba(160, 100, 140, 0.3);
}
.orb-planet.kind-projects::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 112px;
  height: 22px;
  border: 1.5px solid rgba(242, 199, 158, 0.85);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotate(-24deg);
}
.orb-planet.kind-projects::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 132px;
  height: 30px;
  border: 1px dashed rgba(242, 199, 158, 0.35);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotate(-24deg);
}
.orb-planet.kind-writing {
  width: 34px;
  height: 34px;
  background: radial-gradient(
    circle at 30% 28%,
    #fff5ea 0%,
    #e6d4b8 32%,
    #9c93b4 62%,
    #3a3361 100%
  );
  box-shadow:
    inset -11px -3px 14px rgba(0, 0, 0, 0.6),
    0 0 14px rgba(255, 245, 234, 0.12);
}
.orb-planet.kind-contact {
  width: 20px;
  height: 20px;
  background: radial-gradient(
    circle at 30% 28%,
    #f2c79e 0%,
    #8a5f8c 60%,
    #2e1a4b 100%
  );
  box-shadow: 0 0 12px rgba(242, 199, 158, 0.2);
}
.orb-body.is-active .orb-planet {
  animation: orb-halo 3.2s ease-in-out infinite;
  filter: drop-shadow(0 0 18px rgba(242, 199, 158, 0.65));
}
@keyframes orb-halo {
  0%,
  100% {
    filter: drop-shadow(0 0 14px rgba(242, 199, 158, 0.4));
  }
  50% {
    filter: drop-shadow(0 0 30px rgba(242, 199, 158, 0.85));
  }
}

.orb-body .orb-tag {
  position: absolute;
  left: 50%;
  top: 50%;
  margin-top: var(--tag-offset, 42px);
  transform: translateX(-50%);
  white-space: nowrap;
  font-family: var(--orb-mono);
  font-size: 9.5px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--orb-haze);
  opacity: 0;
  transition:
    opacity 0.35s,
    color 0.35s;
  pointer-events: none;
}
.orb-body.is-active .orb-tag,
.orb-body:hover .orb-tag {
  opacity: 1;
  color: var(--orb-ember);
}

.orb-active-label {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  text-align: center;
  z-index: 5;
  pointer-events: none;
  animation: orb-rise 1.1s 1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.orb-active-label .name {
  font-family: var(--orb-display);
  font-style: italic;
  font-weight: 300;
  font-size: 40px;
  letter-spacing: -0.008em;
  color: var(--orb-paper);
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.35);
}
.orb-active-label .serial {
  margin-top: 2px;
  font-family: var(--orb-mono);
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--orb-ember);
}

/* Side index */
.orb-index {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
  align-self: center;
  padding-left: 20px;
  border-left: 1px solid var(--orb-hairline-s);
  animation: orb-rise 1.1s 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.orb-index-head {
  font-family: var(--orb-mono);
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--orb-whisper);
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.orb-index-head .k {
  color: var(--orb-ember);
}
.orb-index-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.orb-index-item {
  display: grid;
  grid-template-columns: 26px 1fr auto;
  align-items: baseline;
  gap: 10px;
  padding: 7px 0 7px 10px;
  margin-left: -10px;
  cursor: pointer;
  color: var(--orb-haze);
  transition:
    color 0.3s,
    background 0.3s;
  position: relative;
  border-radius: 2px;
  background: none;
  border: 0;
  text-align: left;
  width: 100%;
  font: inherit;
}
.orb-index-item .num {
  font-family: var(--orb-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--orb-whisper);
}
.orb-index-item .name {
  font-family: var(--orb-display);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: -0.005em;
  line-height: 1.15;
}
.orb-index-item .meta {
  font-family: var(--orb-mono);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--orb-whisper);
}
.orb-index-item::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 50%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
  transform: translateY(-50%) scale(0.6);
  transition: all 0.3s;
}
.orb-index-item:hover {
  color: var(--orb-paper);
  background: rgba(247, 220, 192, 0.04);
}
.orb-index-item.is-on {
  color: var(--orb-paper);
}
.orb-index-item.is-on .name {
  font-style: italic;
  color: var(--orb-ember);
}
.orb-index-item.is-on::before {
  background: var(--orb-ember);
  box-shadow: 0 0 14px var(--orb-ember);
  transform: translateY(-50%) scale(1);
}

@keyframes orb-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .orb-sky,
  .orb-stars > i,
  .orb-star,
  .orb-star::before,
  .orb-body.is-active .orb-planet {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Visual smoke check**

Run: `npm run dev`
Open: `http://localhost:3000` in a browser.
Expected: The existing carousel homepage still loads (we haven't wired the new components yet). No console errors. New CSS rules are present but unused — that's fine.

Stop the dev server with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Add orbital palette, atmosphere, and scene styles"
```

---

## Task 3: Create `lib/orbitalData.ts` with the planet table

**Files:**

- Create: `lib/orbitalData.ts`

- [ ] **Step 1: Write the file**

```ts
export type PlanetId = 'home' | 'about' | 'projects' | 'blog' | 'contact';

export type PlanetKind = 'home' | 'about' | 'projects' | 'writing' | 'contact';

export type Planet = {
  id: PlanetId;
  kind: PlanetKind;
  label: string;
  numeral: 'I' | 'II' | 'III' | 'IV' | 'V';
  meta: string;
  serial: string;
  note: string;
  tagOffset: number;
  r: number;
  inc: number;
  yaw: number;
  period: number;
  phase: number;
};

export const PLANETS: Planet[] = [
  {
    id: 'home',
    kind: 'home',
    label: 'Home',
    numeral: 'I',
    meta: 'sun',
    serial: 'No. I · small sun',
    note: '"Where it all begins."',
    tagOffset: 24,
    r: 115,
    inc: 0.34,
    yaw: -0.3,
    period: 22,
    phase: 0.4,
  },
  {
    id: 'about',
    kind: 'about',
    label: 'About',
    numeral: 'II',
    meta: 'dune',
    serial: 'No. II · dune world',
    note: '"UCLA CS, Los Angeles, 2026."',
    tagOffset: 30,
    r: 165,
    inc: 0.42,
    yaw: 0.24,
    period: 38,
    phase: 2.1,
  },
  {
    id: 'projects',
    kind: 'projects',
    label: 'Projects',
    numeral: 'III',
    meta: 'ringed',
    serial: 'No. III · ringed · many works',
    note: '"Many works, a few in flight."',
    tagOffset: 36,
    r: 225,
    inc: 0.52,
    yaw: -0.1,
    period: 66,
    phase: 3.2,
  },
  {
    id: 'blog',
    kind: 'writing',
    label: 'Writing',
    numeral: 'IV',
    meta: 'crescent',
    serial: 'No. IV · crescent moon',
    note: '"Notes on agents, systems, and taste."',
    tagOffset: 28,
    r: 285,
    inc: 0.28,
    yaw: 0.38,
    period: 102,
    phase: 1.6,
  },
  {
    id: 'contact',
    kind: 'contact',
    label: 'Contact',
    numeral: 'V',
    meta: 'distant',
    serial: 'No. V · distant body',
    note: '"Always open to a quiet signal."',
    tagOffset: 22,
    r: 335,
    inc: 0.46,
    yaw: -0.22,
    period: 160,
    phase: 5.0,
  },
];

export const SCENE_SIZE = 700;
export const SCENE_CENTER = SCENE_SIZE / 2;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/orbitalData.ts
git commit -m "Add orbital data: planet parameters and display metadata"
```

---

## Task 4: Create `components/OrbitalScene.tsx`

**Files:**

- Create: `components/OrbitalScene.tsx`

This component renders the star, the SVG orbit rings, and the five planet buttons. It runs a `requestAnimationFrame` loop that writes transforms/opacity directly to DOM refs (avoids a React re-render per frame). It honors `prefers-reduced-motion` by freezing the loop.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import {
  PLANETS,
  SCENE_CENTER,
  SCENE_SIZE,
  type PlanetId,
} from '@/lib/orbitalData';

type Props = {
  activeId: PlanetId;
  onHover: (id: PlanetId | null) => void;
  onSelect: (id: PlanetId) => void;
};

export function OrbitalScene({ activeId, onHover, onSelect }: Props) {
  const bodyRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    let raf = 0;
    const start = performance.now();

    const apply = (t: number) => {
      PLANETS.forEach((p) => {
        const el = bodyRefs.current[p.id];
        if (!el) return;
        const phi = (t / p.period) * Math.PI * 2 + p.phase;
        const x0 = p.r * Math.cos(phi);
        const y0 = p.r * Math.sin(phi);
        const y1 = y0 * Math.cos(p.inc);
        const z = y0 * Math.sin(p.inc);
        const cosY = Math.cos(p.yaw);
        const sinY = Math.sin(p.yaw);
        const sx = cosY * x0 - sinY * y1;
        const sy = sinY * x0 + cosY * y1;
        const d = z / p.r;
        const norm = (d + 1) / 2;
        const scale = 0.75 + 0.35 * norm * 1.1;
        const opacity = 0.55 + 0.45 * norm;
        const blur = d < -0.3 ? (Math.abs(d + 0.3) * 2.4).toFixed(1) : '0';
        el.style.transform = `translate(calc(-50% + ${sx.toFixed(2)}px), calc(-50% + ${sy.toFixed(2)}px)) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = String(100 + Math.round(z));
        el.style.filter = blur === '0' ? '' : `blur(${blur}px)`;
      });
    };

    if (prefersReducedMotion) {
      apply(0);
      return;
    }

    const tick = (now: number) => {
      apply((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="orb-scene" aria-label="Orbital scene">
      <div className="orb-star" aria-hidden="true" />

      <svg
        className="orb-rings"
        viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {PLANETS.map((p) => {
          const deg = ((p.yaw * 180) / Math.PI).toFixed(2);
          return (
            <ellipse
              key={p.id}
              cx={SCENE_CENTER}
              cy={SCENE_CENTER}
              rx={p.r}
              ry={p.r * Math.cos(p.inc)}
              transform={`rotate(${deg} ${SCENE_CENTER} ${SCENE_CENTER})`}
              className={p.id === activeId ? 'orb-ring-bright' : undefined}
            />
          );
        })}
      </svg>

      <div className="orb-bodies">
        {PLANETS.map((p) => {
          const isActive = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              ref={(el) => {
                bodyRefs.current[p.id] = el;
              }}
              className={`orb-body${isActive ? ' is-active' : ''}`}
              data-id={p.id}
              onClick={() => onSelect(p.id)}
              onMouseEnter={() => onHover(p.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(p.id)}
              onBlur={() => onHover(null)}
              aria-label={`${p.numeral} · ${p.label}`}
            >
              <span
                className={`orb-planet kind-${p.kind}`}
                aria-hidden="true"
              />
              <span
                className="orb-tag"
                style={{ ['--tag-offset' as string]: `${p.tagOffset}px` }}
              >
                {p.numeral} · {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: exits 0.

Run: `npm run lint`
Expected: no new errors in `components/OrbitalScene.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/OrbitalScene.tsx
git commit -m "Add OrbitalScene component with billboarded planets"
```

---

## Task 5: Create `components/SideIndex.tsx`

**Files:**

- Create: `components/SideIndex.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { PLANETS, type PlanetId } from '@/lib/orbitalData';

type Props = {
  activeId: PlanetId;
  onHover: (id: PlanetId | null) => void;
  onSelect: (id: PlanetId) => void;
};

export function SideIndex({ activeId, onHover, onSelect }: Props) {
  const active = PLANETS.find((p) => p.id === activeId) ?? PLANETS[0];

  return (
    <aside className="orb-index" aria-label="Section index">
      <div className="orb-index-head">
        <span className="k">Index</span>
        <span>0{PLANETS.length} worlds</span>
      </div>
      <ul className="orb-index-list" role="list">
        {PLANETS.map((p) => {
          const isOn = p.id === activeId;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`orb-index-item${isOn ? ' is-on' : ''}`}
                onClick={() => onSelect(p.id)}
                onMouseEnter={() => onHover(p.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(p.id)}
                onBlur={() => onHover(null)}
              >
                <span className="num">{p.numeral}</span>
                <span className="name">{p.label}</span>
                <span className="meta">{p.meta}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p
        className="orb-index-note"
        aria-live="polite"
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--orb-hairline-s)',
          fontFamily: 'var(--orb-display)',
          fontStyle: 'italic',
          fontWeight: 300,
          fontSize: '14.5px',
          lineHeight: 1.55,
          color: 'var(--orb-haze)',
        }}
      >
        {active.note}
        <span
          style={{
            color: 'var(--orb-ember)',
            fontStyle: 'normal',
            fontFamily: 'var(--orb-mono)',
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            display: 'block',
            marginTop: '6px',
          }}
        >
          Currently observing · {active.label.toLowerCase()}
        </span>
      </p>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` → exits 0.
Run: `npm run lint` → no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/SideIndex.tsx
git commit -m "Add SideIndex component with Roman-numeral world list"
```

---

## Task 6: Replace `components/HomeHero.tsx` with the orbital hero wrapper

The existing `HomeHero.tsx` is unused by `app/page.tsx` (grep confirms: only referenced inside itself and in `README.md`). We replace its contents wholesale to avoid leaving a stale component around.

**Files:**

- Modify (full replacement): `components/HomeHero.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OrbitalScene } from '@/components/OrbitalScene';
import { SideIndex } from '@/components/SideIndex';
import { PLANETS, type PlanetId } from '@/lib/orbitalData';

type Props = {
  selectedId: PlanetId | null;
  onSelect: (id: PlanetId) => void;
};

export function HomeHero({ selectedId, onSelect }: Props) {
  const [hoverId, setHoverId] = useState<PlanetId | null>(null);
  const [stars, setStars] = useState<
    Array<{
      left: string;
      top: string;
      size: string;
      opacity: string;
      delay: string;
      duration: string;
    }>
  >([]);

  useEffect(() => {
    const next = Array.from({ length: 90 }, () => {
      const size = (Math.random() * 1.3 + 0.6).toFixed(2);
      return {
        left: `${(Math.random() * 100).toFixed(2)}%`,
        top: `${(Math.random() * 100).toFixed(2)}%`,
        size: `${size}px`,
        opacity: (Math.random() * 0.5 + 0.25).toFixed(2),
        delay: `${(Math.random() * 5).toFixed(2)}s`,
        duration: `${(3 + Math.random() * 4).toFixed(2)}s`,
      };
    });
    setStars(next);
  }, []);

  const activeId: PlanetId = useMemo(() => {
    if (hoverId) return hoverId;
    if (selectedId) return selectedId;
    return 'home';
  }, [hoverId, selectedId]);

  const active = PLANETS.find((p) => p.id === activeId) ?? PLANETS[0];

  const handleHover = useCallback((id: PlanetId | null) => {
    setHoverId(id);
  }, []);

  const handleSelect = useCallback(
    (id: PlanetId) => {
      onSelect(id);
    },
    [onSelect],
  );

  return (
    <>
      <div className="orb-sky" aria-hidden="true" />
      <div className="orb-stars" aria-hidden="true">
        {stars.map((s, i) => (
          <i
            key={i}
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              animationDelay: s.delay,
              animationDuration: s.duration,
            }}
          />
        ))}
      </div>
      <div className="orb-grain" aria-hidden="true" />

      <div className="orb-shell">
        <div />
        <div className="orb-stage">
          <div className="orb-title">
            <div className="eye">An atlas of worlds · 2026</div>
            <h1>
              Worlds <em>in orbit</em>.
            </h1>
          </div>

          <div
            style={{
              gridColumn: '2 / 3',
              gridRow: '2 / 3',
              position: 'relative',
            }}
          >
            <OrbitalScene
              activeId={activeId}
              onHover={handleHover}
              onSelect={handleSelect}
            />
            <div className="orb-active-label">
              <div className="name">{active.label}</div>
              <div className="serial">{active.serial}</div>
            </div>
          </div>

          <SideIndex
            activeId={activeId}
            onHover={handleHover}
            onSelect={handleSelect}
          />
        </div>
        <div />
      </div>
    </>
  );
}
```

Notes:

- `stars` is generated inside `useEffect` so SSR renders an empty star field, avoiding a hydration mismatch from `Math.random()`.
- `hoverId` overrides `selectedId` for the visual "active" cue — this keeps the index and scene in sync on pointer feedback without changing routing state.
- The inner `<div style={{gridColumn:'2 / 3'...}}>` places the scene in the grid cell and lets the absolute-positioned `.orb-active-label` sit at the bottom of the scene. `.orb-scene` itself is inside this wrapper; that's fine because its own CSS `grid-column` would only take effect at the top level — we rely on the wrapper for placement.

Wait — `.orb-scene` already has `grid-column: 2/3; grid-row: 2/3;` in `globals.css`, and we just wrapped it in a non-grid-participating div. Fix this by removing those `grid-column/grid-row` declarations from `.orb-scene` (they belong on the wrapper instead). Do that as part of Step 2.

- [ ] **Step 2: Clean up `.orb-scene` grid placement in `globals.css`**

Open `app/globals.css` and edit the orbital section so the `.orb-scene` rule no longer sets `grid-column` / `grid-row` (placement is handled by the wrapper div in `HomeHero`). Also update `.orb-title` / `.orb-index` to still use grid placement.

Find this block:

```css
.orb-scene {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  width: var(--orb-scene);
  height: var(--orb-scene);
  justify-self: center;
  position: relative;
}
```

Replace with:

```css
.orb-scene {
  width: var(--orb-scene);
  height: var(--orb-scene);
  margin: 0 auto;
  position: relative;
}
```

And add a helper for the wrapper:

```css
.orb-scene-slot {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  position: relative;
  width: var(--orb-scene);
  justify-self: center;
}
```

Then change the `HomeHero` wrapper `<div style={{gridColumn:'2 / 3'...}}>` to `<div className="orb-scene-slot">` and drop the inline style.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` → exits 0.
Run: `npm run lint` → no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/HomeHero.tsx app/globals.css
git commit -m "Rewrite HomeHero as orbital scene + side index wrapper"
```

---

## Task 7: Wire `HomeHero` into `app/page.tsx` and remove the old carousel

**Files:**

- Modify: `app/page.tsx`

- [ ] **Step 1: Swap Carousel3D for HomeHero**

Open `app/page.tsx`. Make the following changes:

1. Replace the `Carousel3D, type Section` import with `HomeHero` and `PlanetId`:
   ```tsx
   import { HomeHero } from '@/components/HomeHero';
   import type { PlanetId } from '@/lib/orbitalData';
   ```
2. Drop the `SceneRing` dynamic import block (4 lines starting `const SceneRing = dynamic(...)` and the `import dynamic from 'next/dynamic';` line).
3. Change `useState<string | null>('home')` to `useState<PlanetId | null>('home')`.
4. Replace the three Carousel3D-specific callbacks (`handleSelect`, `handleActiveChange`, plus the `isPaused` state and `handlePanelClick`/`handleClose` pause handling) with a single select handler. `ContentPanel` still needs `onClose` / `onPanelClick`; keep those but they no longer touch pause state. Keep `isPaused` removed entirely (ContentPanel's use of it is purely visual — check the next step).

5. Final JSX for `<main>`:
   ```tsx
   <main className="app-main">
     <HomeHero
       selectedId={selectedSection}
       onSelect={(id) => setSelectedSection(id)}
     />
     <ContentPanel
       sectionId={selectedSection}
       onClose={handleClose}
       onOpenModal={handleOpenModal}
       isPaused={false}
       onPanelClick={() => {}}
     />
   </main>
   ```

Here is the full replacement for `app/page.tsx`:

```tsx
'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HomeHero } from '@/components/HomeHero';
import { ThemeBar } from '@/components/ThemeBar';
import { ContentPanel } from '@/components/ContentPanel';
import { Modal } from '@/components/Modal';
import { VisitorCount } from '@/components/VisitorCount';
import {
  experiences,
  projects,
  callHighlights,
  callSocialProof,
} from '@/lib/siteData';
import type { PlanetId } from '@/lib/orbitalData';

const CALENDLY_URL =
  'https://calendly.com/yxiao1717/glitch-dev-team-officer-interview';
const CALENDLY_EMBED_URL = `${CALENDLY_URL}?embed_domain=tylerxiao.com&embed_type=Inline`;

function TimelineModal({ onClose }: { onClose: () => void }) {
  const focusAreas = Array.from(
    new Set(experiences.flatMap((exp) => exp.focus)),
  ).sort();

  return (
    <Modal title="Past Experience" onClose={onClose}>
      <div className="modal-section">
        <div className="modal-chips">
          {focusAreas.map((area) => (
            <span key={area} className="chip">
              {area}
            </span>
          ))}
        </div>
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">Timeline</h3>
        {experiences.map((exp) => (
          <div key={`${exp.company}-${exp.role}`} className="modal-exp-card">
            <div className="modal-exp-meta">
              <span>
                {exp.start} — {exp.end}
              </span>
              <span className="modal-exp-company">{exp.company}</span>
            </div>
            <h4 className="modal-exp-role">{exp.role}</h4>
            <p className="modal-exp-summary">{exp.summary}</p>
            <div className="modal-chips">
              {exp.focus.map((label) => (
                <span key={label} className="chip">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">Projects</h3>
        <div className="modal-project-grid">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.link}
              className="modal-project-card"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="modal-project-role">{project.role}</span>
              <h4 className="modal-project-name">{project.title}</h4>
              <p className="modal-project-desc">{project.description}</p>
              <div className="modal-chips">
                {project.tech.map((tech) => (
                  <span key={tech} className="panel-tech-chip">
                    {tech}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function AllProjectsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="All Projects" onClose={onClose}>
      <div className="modal-project-grid">
        {projects.map((project) => (
          <Link
            key={project.title}
            href={project.link}
            className="modal-project-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="modal-project-img-slot"
              data-project={project.title.toLowerCase().replace(/\s+/g, '-')}
            >
              {project.image ? (
                <Image
                  src={project.image}
                  alt={`${project.title} screenshot`}
                  width={640}
                  height={360}
                  className="modal-project-img"
                />
              ) : (
                <span className="modal-project-img-placeholder">&#9635;</span>
              )}
            </div>
            <span className="modal-project-role">{project.role}</span>
            <h4 className="modal-project-name">{project.title}</h4>
            <p className="modal-project-desc">{project.description}</p>
            <div className="modal-chips">
              {project.tech.map((tech) => (
                <span key={tech} className="panel-tech-chip">
                  {tech}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </Modal>
  );
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Schedule a Call" onClose={onClose}>
      <div className="modal-section">
        <p className="modal-desc">
          15-minute chat to align on goals. We&rsquo;ll cover what you&rsquo;re
          building, how I can help, and immediate next steps.
        </p>
        <div className="modal-action-row">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-btn-primary"
          >
            Open Calendly &#8599;
          </a>
          <a href="mailto:tylerxiao@ucla.edu" className="modal-btn-secondary">
            Email instead
          </a>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-calendly-embed">
          <iframe
            src={CALENDLY_EMBED_URL}
            title="Schedule a call with Tyler Xiao"
            className="modal-calendly-iframe"
            frameBorder="0"
          />
        </div>
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">What to expect</h3>
        <div className="modal-list">
          {callHighlights.map((item) => (
            <div key={item} className="modal-list-item">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">Background</h3>
        <div className="modal-list">
          {callSocialProof.map((item) => (
            <div key={item} className="modal-list-item">
              <span className="modal-check">✓</span> {item}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function Home() {
  const [selectedSection, setSelectedSection] = useState<PlanetId | null>(
    'home',
  );
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const handleSelect = useCallback((id: PlanetId) => {
    setSelectedSection(id);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedSection(null);
  }, []);

  const handleOpenModal = useCallback((id: string) => {
    setActiveModal(id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link href="/" className="app-logo">
          TX
        </Link>
        <div className="app-topbar-right">
          <VisitorCount />
          <Link href="/terminal" className="terminal-toggle-btn">
            <span className="terminal-toggle-dot" />
            Terminal
          </Link>
        </div>
      </header>

      <main className="app-main">
        <HomeHero selectedId={selectedSection} onSelect={handleSelect} />
        <ContentPanel
          sectionId={selectedSection}
          onClose={handleClose}
          onOpenModal={handleOpenModal}
          isPaused={false}
          onPanelClick={() => {}}
        />
      </main>

      <ThemeBar />

      {activeModal === 'timeline' && (
        <TimelineModal onClose={handleCloseModal} />
      )}
      {activeModal === 'schedule' && (
        <ScheduleModal onClose={handleCloseModal} />
      )}
      {activeModal === 'all-projects' && (
        <AllProjectsModal onClose={handleCloseModal} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: exits 0. If `ContentPanel`'s prop types require `sectionId: string | null` rather than `PlanetId | null`, cast at the boundary: `sectionId={selectedSection ?? null}`. The component treats it as a string tag, so no runtime change.

Run: `npm run lint`
Expected: no new errors in `app/page.tsx`.

- [ ] **Step 3: Smoke test in browser**

Run: `npm run dev`
Open: `http://localhost:3000`
Expected:

- Dusk gradient background loads, grain overlay visible.
- Central sun with five orbiting planets, rings shown as tilted ellipses.
- Planets stay front-facing (no tilt), grow/shrink and brighten/dim as they orbit.
- Hovering a planet highlights it and the matching side-index entry.
- Clicking a planet opens the `ContentPanel` for that section.
- Clicking an index entry also opens the panel.
- No console errors.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "Wire homepage to orbital hero and drop Carousel3D usage"
```

---

## Task 8: Delete the obsolete `Carousel3D` component

**Files:**

- Delete: `components/Carousel3D.tsx`

- [ ] **Step 1: Verify nothing else imports it**

Run (in repo root):

```bash
grep -rn "Carousel3D" --include="*.ts" --include="*.tsx" .
```

Expected: matches only inside the doc/plan files (and zero `.ts`/`.tsx` imports after Task 7).

If any other `.ts`/`.tsx` file still imports it, stop and fix those imports first — do not proceed until only docs/specs reference the name.

- [ ] **Step 2: Delete the file**

```bash
rm components/Carousel3D.tsx
```

- [ ] **Step 3: Typecheck + lint + build**

Run: `npx tsc --noEmit`
Expected: exits 0.

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build completes (warnings OK, errors not OK). This catches any remaining stale references that `tsc --noEmit` missed via dynamic imports.

- [ ] **Step 4: Commit**

```bash
git add -A components/
git commit -m "Remove Carousel3D component"
```

---

## Task 9: Reduced-motion pass + cross-browser smoke

**Files:**

- No new changes unless a bug surfaces.

- [ ] **Step 1: Toggle reduced motion and verify freeze**

Reduced-motion test:

- **macOS:** System Settings → Accessibility → Display → **Reduce motion** ON.
- **Chrome devtools:** Rendering panel → **Emulate CSS media feature `prefers-reduced-motion`** → `reduce`.

Run: `npm run dev` and reload `http://localhost:3000`.
Expected:

- Planets frozen at their initial phase (no orbital motion).
- Star breathing animation stopped.
- Twinkling stars stopped.
- Hover, click, and index selection still work.

- [ ] **Step 2: Viewport smoke**

Resize the browser to 1440×900 and 1024×768. The layout is intentionally desktop-first and does not yet have a mobile treatment (spec's "Out of Scope"). Confirm no console errors at these widths. If the scene overflows horizontally at 1024px, that is expected — it will be addressed in a follow-up mobile plan, not here.

- [ ] **Step 3: If reduced-motion fails**

If planets still move with reduced motion:

- Check `components/OrbitalScene.tsx`: the early return for `prefersReducedMotion` must run `apply(0)` once and then `return;` without calling `requestAnimationFrame`.
- Verify `matchMedia('(prefers-reduced-motion: reduce)').matches` returns `true` in the browser console.

If twinkling stars still animate:

- Check `globals.css` media query at the end of the orbital section — it must include `.orb-stars > i` (direct child) not `.orb-stars i` (any descendant) to avoid accidentally matching the wrong element later. Either works for today's markup; don't change it unless it's actually broken.

- [ ] **Step 4: If no changes were needed, skip the commit. Otherwise:**

```bash
git add app/globals.css components/OrbitalScene.tsx
git commit -m "Tighten reduced-motion handling for orbital scene"
```

---

## Task 10: Final end-to-end verification

**Files:** none

- [ ] **Step 1: Run all verifications in order**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must exit 0.

- [ ] **Step 2: Visual pass on the production build**

```bash
npm run start
```

Open `http://localhost:3000`.
Expected:

- Fonts are Cormorant Garamond (title, active label) + IBM Plex Sans (index names, body) + IBM Plex Mono (serial, metadata) — no FOUT, no Satoshi/Clash fallback.
- Title reads "Worlds _in orbit_." with "in orbit" in italic ember.
- Five planets orbit at visibly different speeds (inner fastest).
- All planet labels read left-to-right normally regardless of orbit position.
- Hovering an index entry updates the halo on the matching planet.
- Clicking a planet or index entry opens the section's ContentPanel.
- No console errors; no hydration warnings.

Stop the production server with Ctrl-C.

- [ ] **Step 3: Summary commit if anything drifted during verification**

If any small CSS or typing nit was fixed during the visual pass:

```bash
git add -A
git commit -m "Polish orbital homepage after end-to-end verification"
```

Otherwise no commit — the work is done.

---

## Spec Coverage Check

| Spec section                                      | Covered by task(s)                                                                                                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography (Cormorant, IBM Plex Sans/Mono)        | Task 1                                                                                                                                                                                                                      |
| Palette CSS variables                             | Task 2                                                                                                                                                                                                                      |
| Atmosphere (sky gradient, grain, twinkling stars) | Task 2 (CSS) + Task 6 (star DOM)                                                                                                                                                                                            |
| Grid layout (1fr / scene / 260px / 1fr)           | Task 2 (CSS) + Task 6 (markup)                                                                                                                                                                                              |
| Orbital mechanics table + motion loop             | Tasks 3 + 4                                                                                                                                                                                                                 |
| Billboard rule                                    | Task 4                                                                                                                                                                                                                      |
| Orbit rings as SVG ellipses                       | Task 4                                                                                                                                                                                                                      |
| Central star breathing/corona                     | Task 2 (CSS) + Task 4 (markup)                                                                                                                                                                                              |
| Five planet visual presets                        | Task 2 (CSS) + Task 4 (classes)                                                                                                                                                                                             |
| Side index (Roman numerals, hover/click)          | Task 5                                                                                                                                                                                                                      |
| Metadata strip (mono serial + italic callout)     | Task 6                                                                                                                                                                                                                      |
| Interaction: hover halo, click → select           | Tasks 4 + 5 + 6 + 7                                                                                                                                                                                                         |
| Pointer parallax                                  | **Not covered** — spec lists it but the v3 prototype already decoupled parallax onto the `.sky`/`.stars` layers; porting it requires a separate pointer listener. Added as a TODO follow-up rather than blocking this plan. |
| Reduced-motion handling                           | Task 4 (JS early return) + Task 2 (CSS media query) + Task 9 (verification)                                                                                                                                                 |
| Remove Carousel3D                                 | Task 8                                                                                                                                                                                                                      |
| `next/font/google` wiring                         | Task 1                                                                                                                                                                                                                      |

**Deferred (explicit):** pointer parallax is called out in the spec's Interaction section but is deliberately not implemented in this plan — it adds a second render path for decorative effect. If the user wants it, a small follow-up task can add a `useEffect` in `HomeHero` that writes `transform` to the `.orb-sky` and `.orb-stars` refs based on `pointermove`. Flag this to the user before starting execution.

---

## Notes for the Executing Agent

- Do not run `npm install`; all deps in use are already present in `package.json`.
- Do not touch `components/Terminal/**`, `components/ThemeBar.tsx`, `components/VisitorCount.tsx`, `components/ContentPanel.tsx`, `app/blog/**`, `app/past-experience/**`, `app/schedule-a-call/**`, `app/terminal/**`. Those pages continue to use the existing layout and styles.
- If `ContentPanel`'s TypeScript signature requires adjustments for `PlanetId`, coerce at the call site (`sectionId={selectedSection}` should already work since `PlanetId` extends `string`).
- If lint reports an unused-import warning during intermediate tasks (e.g., `Image` in `app/page.tsx` before the modals are wired back in) double-check the full-file replacement in Task 7 — it keeps `Image` because `AllProjectsModal` uses it.
- Commits should be small and per-task as written. Do not batch.
