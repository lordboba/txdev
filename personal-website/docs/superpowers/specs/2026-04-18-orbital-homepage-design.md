---
name: Orbital Homepage Redesign
description: Spec for redesigning the personal-website homepage with an ambient/architectural aesthetic and a physics-driven orbital carousel.
status: approved-for-planning
date: 2026-04-18
---

# Orbital Homepage Redesign

## Goal

Replace the current `Carousel3D` rotating-cards component and surrounding hero styling with an ambient, painterly, planetary-orbit composition. Sections become planets that orbit a central star on independently tilted planes. The carousel feel is preserved (sections move continuously, one is "active"), but the piece reads as artwork rather than a generic CSS spinner.

Visual reference: `.superpowers/brainstorm/47689-1776549507/content/orbital-v3.html`.

## Aesthetic Direction

Blend of two directions explored during brainstorming:

- **Ambient / painterly background** — dusk gradient (indigo → violet → rust → peach ember), grain overlay, faint twinkling star field, pointer-driven parallax.
- **Architectural / orbital motion** — five sections rendered as planets orbiting a central star on ellipses of differing radius, inclination, yaw, and period.

### Typography

- Display: **Cormorant Garamond** (light italic for callouts, medium for headings)
- Sans: **IBM Plex Sans** (UI, index, body)
- Mono: **IBM Plex Mono** (serials, small caps metadata)

Explicitly rejected: Inter, Satoshi, Gambetta, and any fully monospace-dominant "robotic" treatment.

### Palette (CSS variables)

- `--bg-deep`: deep indigo (#14111d range)
- `--bg-mid`: violet dusk
- `--bg-warm`: rust / peach ember glow from lower-right
- `--ink`: warm off-white for primary text
- `--ink-dim`: muted warm grey for secondary text
- `--accent`: peach ember (#f0b090 range) for active/hover states
- `--line`: low-alpha warm line for orbit strokes

## Layout

Grid on the homepage hero section:

```
grid-template-columns: 1fr var(--scene) 260px 1fr
```

- Left gutter: flexible
- Center: **scene** (~700px square) — star + orbits + planets
- Right: **side index** (Roman numerals I–V listing the five sections)
- Right gutter: flexible

Page header (name + tagline in Cormorant italic) sits above the scene. A small metadata row (mono serial + italic callout for the active section) sits below.

This clusters interactive elements near the center of the viewport — per user feedback, "items were far apart and it was difficult to find key pieces."

## Orbital Mechanics

Five planets correspond to the site sections:

| Section  | radius | inclination |   yaw | period (s) | phase |
| -------- | -----: | ----------: | ----: | ---------: | ----: |
| Home     |    115 |        0.34 | −0.30 |         22 |   0.4 |
| About    |    165 |        0.42 |  0.24 |         38 |   2.1 |
| Projects |    225 |        0.52 | −0.10 |         66 |   3.2 |
| Writing  |    285 |        0.28 |  0.38 |        102 |   1.6 |
| Contact  |    335 |        0.46 | −0.22 |        160 |   5.0 |

Inner planets orbit faster (Kepler-style feel). Periods chosen so all five are visibly in motion without feeling frantic.

### Motion loop (per frame)

For each planet at time `t`:

```
phi  = (t / period) * 2π + phase
x0   = r * cos(phi)
y0   = r * sin(phi)
y1   = y0 * cos(inc)
z    = y0 * sin(inc)
sx   = cos(yaw)*x0 - sin(yaw)*y1
sy   = sin(yaw)*x0 + cos(yaw)*y1
d    = z / r                         // −1 (far) … +1 (near)
scale   = 0.75 + 0.35 * ((d+1)/2) * 1.1
opacity = 0.55 + 0.45 * ((d+1)/2)
blur    = d < -0.3 ? |d + 0.3| * 2.4 : 0
zIndex  = 100 + round(z)
```

Planet element:

```
transform: translate(calc(-50% + sx px), calc(-50% + sy px)) scale(scale)
```

### Billboard rule (critical)

Planets are **2D divs positioned by JS**. They never inherit any 3D rotation. Depth is conveyed exclusively via `scale`, `opacity`, `blur`, and `z-index`. All labels remain front-facing and readable regardless of orbital position.

Rationale: earlier CSS-3D approach (`orbital-v2.html`) produced tilted, reversed labels because counter-rotations compounded incorrectly. JS-driven positioning cleanly separates orbit math from rendering orientation.

### Orbit rings

Rendered as SVG `<ellipse>` elements in the scene background:

```
rx = r
ry = r * cos(inclination)
transform: rotate(yaw-in-degrees)
stroke: var(--line), very low alpha, 1px
```

Rings convey plane tilt; planets do not.

## Components

### `components/OrbitalScene.tsx` (new)

Owns the scene:

- Five planet divs (one per section)
- Central star (breathing animation, corona)
- SVG overlay with five ellipse orbits
- requestAnimationFrame loop driving planet transforms
- Accepts an `activeId` prop; the active planet gets an enhanced halo + pulse

Exposed callbacks: `onHover(id)`, `onSelect(id)`.

Planet visual presets (kept distinct so each section has identity):

- **home** — 26px sun-like radial gradient
- **about** — 38px dune gradient
- **projects** — 54px ringed body (CSS `::before`/`::after` 2D ellipses)
- **writing** — 34px crescent gradient
- **contact** — 20px distant dim body

### `components/SideIndex.tsx` (new)

Vertical list of Roman numerals I–V paired with section names. Hover/click updates `activeId`. Styled in IBM Plex Sans small caps with a warm-accent hover rule.

### `components/HomeHero.tsx` (refactor)

Drives layout and owns `activeId` state. Hosts:

- Cormorant italic display name + tagline (above scene)
- `<OrbitalScene>` + `<SideIndex>` in the grid
- Metadata strip below scene: mono serial (e.g., `03 / 05`) + italic callout of active section name

### `components/Carousel3D.tsx` (remove)

Deleted. Consumers (currently `app/page.tsx`) switch to `HomeHero`.

### `app/globals.css` (update)

- Add `@import` for Cormorant Garamond, IBM Plex Sans, IBM Plex Mono (or `next/font/google` in `layout.tsx` — preferred for perf)
- Introduce CSS variables for the new palette
- Body background: layered radial gradients + SVG noise filter for grain
- Twinkling star field: absolutely-positioned layer with ~90 small divs animated via staggered CSS keyframes

### `app/layout.tsx` (update)

Load fonts via `next/font/google` and bind to CSS variables so `globals.css` can reference them without FOUT.

## Interaction

- **Hover a planet** → soft halo grows; label tag becomes fully opaque; side index highlights matching entry.
- **Click a planet or index entry** → sets `activeId`; active planet gets persistent pulse + stronger halo; metadata strip updates; subsequent navigation is triggered by the existing section routing (unchanged from current site behavior).
- **Pointer parallax** → scene translates ≤8px based on pointer position for subtle depth.
- **Reduced motion** → `prefers-reduced-motion: reduce` pauses orbit animation (planets frozen at initial phase), disables star twinkle and parallax. Interaction still works.

## Data Flow

`HomeHero` holds `activeId` (default `'home'`). Passes it to `OrbitalScene` and `SideIndex`. Both call `setActiveId` through their callbacks. Section routing (navigating to About / Projects / etc.) reuses whatever navigation model `app/page.tsx` currently uses for the old carousel — this spec does not change routing.

## Out of Scope

- Page content for About / Projects / Writing / Contact beyond ensuring existing routes still work.
- Blog index restyling (separate concern).
- Theme toggle behavior (existing `ThemeBar`/`ThemeToggle` stays as-is for now; palette changes are applied within the current dark theme).
- Mobile layout below 720px — to be addressed in a follow-up spec; initial implementation will gracefully fall back to a stacked layout with a simplified orbit (single plane, smaller radii) or a list.

## Testing

- Visual: dev server smoke test at 1440×900 and 1024×768; verify planets never tilt, labels always readable, scene stays centered.
- Motion: verify orbit periods feel correct (inner faster), no jank on a fresh Chrome profile.
- Accessibility: tab order reaches side index; active planet change announces via `aria-live="polite"` on the metadata strip; `prefers-reduced-motion` honored.
- Type check + lint pass.

## Open Questions (for plan phase, not design)

- Should we preserve the existing section content panels (`ContentPanel.tsx`) or redesign those alongside the orbital scene? (Recommendation: keep them this pass; they'll be reviewed once the orbital shell lands.)
- Font loading: `next/font/google` vs `@import` — the former is recommended but requires `layout.tsx` changes. Assumed `next/font/google`.
