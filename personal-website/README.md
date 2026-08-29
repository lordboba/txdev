# Tyler Xiao Personal Website

Personal portfolio built with Next.js 16, React 19, React Three Fiber, and Tailwind CSS v4. The current homepage is an interactive workbench for exploring Tyler's profile, work, current experiments, and the site's visual history.

## Current Design

- A WebGL bench serves as the main navigation surface on desktop.
- Work, Profile, Signals, and History are four views over the same scene and source data.
- Mobile and reduced-motion visitors receive accessible DOM equivalents.
- Dark and light themes share the same editorial and studio-inspired visual language.
- Project imagery uses real captures or text-only plates. Invented product screenshots are intentionally excluded.

## Main Routes

- `/` — current Bench homepage
- `/orbital` — previous orbital homepage
- `/concept` — internal comparison board with four design directions
- `/blog`
- `/blog/[slug]`
- `/past-experience` — extended timeline and project archive
- `/schedule-a-call` — Calendly booking page
- `/terminal` — terminal-era homepage

## Implementation Notes

Most shared visual decisions flow through [`app/globals.css`](./app/globals.css). The Bench implementation is split between React controls and the Three.js scene:

- [`components/home/BenchHome.tsx`](./components/home/BenchHome.tsx)
- [`components/concept/bench/Bench.tsx`](./components/concept/bench/Bench.tsx)
- [`components/concept/bench/BenchScene.tsx`](./components/concept/bench/BenchScene.tsx)
- [`components/concept/conceptData.ts`](./components/concept/conceptData.ts)
- [`lib/siteData.ts`](./lib/siteData.ts)

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

This README describes the current routed experience. Experimental views remain available for comparison and historical reference.
