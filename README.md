# Tyler Xiao Personal Website

Personal portfolio built with Next.js 16, React 19, and Tailwind CSS v4. The site is designed to feel technical, warm, and a little hidden-in-plain-sight: editorial typography, terminal-native interactions, gold accent lighting, and motion that reacts to user intent instead of running constantly.

## Current Design Direction

- Dark by default, with a light theme that keeps the same hierarchy and interaction model.
- Warm gold accent as the primary highlight color, with teal reserved as a secondary support tone.
- Clear type pairing:
  - `Clash Display` for headings
  - `Satoshi` for body and UI text
  - `Monaspace Neon` for terminal and monospace surfaces
- Portfolio framing that mixes product-engineering polish with terminal-inspired affordances.

## Recent Design Choices

- Hero now supports two modes:
  - headline mode for the main personal pitch
  - a hidden terminal mode for interactive exploration
- Yellow accent surfaces now use dark ink for contrast-sensitive CTA treatment.
- Terminal colors were updated to match the site accent system instead of the older green-heavy palette.
- Motion favors reveal-on-scroll, tilt, and subtle glow effects over always-on animation.
- Navigation stays lightweight and sticky, with an accent indicator on desktop and a compact mobile menu.

## Site Structure

- `/`
  - sticky navigation
  - hero with headline/terminal mode toggle
  - about/status monitor
  - experience timeline
  - selected projects
  - writing feed
  - contact block
- `/blog`
  - changelog-style writing index
- `/blog/[slug]`
  - individual writing pages
- `/past-experience`
  - extended timeline and project archive
- `/schedule-a-call`
  - CTA-led booking page with Calendly embed
- `/terminal`
  - fullscreen terminal experience

## Design System Notes

Most visual decisions flow through [`app/globals.css`](./app/globals.css):

- Theme tokens define background, surface, foreground, accent, divider, and terminal colors.
- Light mode preserves the same layout language rather than becoming a separate design.
- Terminal-specific tokens control shell background, accent-led text, muted text, links, and chip states.
- Shared utility classes handle accent CTA ink color, terminal command chips, reveal animations, and motion polish.

Primary implementation files:

- [`app/page.tsx`](./app/page.tsx)
- [`components/HomeHero.tsx`](./components/HomeHero.tsx)
- [`components/NavBar.tsx`](./components/NavBar.tsx)
- [`components/Terminal/Terminal.tsx`](./components/Terminal/Terminal.tsx)
- [`components/Terminal/useTerminal.tsx`](./components/Terminal/useTerminal.tsx)

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Stack

- Next.js 16
- React 19
- Tailwind CSS v4
- TypeScript

## Status

This README reflects the current visual system in the app code rather than the default `create-next-app` template.
