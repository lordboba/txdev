# Personal Website Design

## Aesthetic Direction — "Midnight Forge"

A precision-engineered dark interface that pairs warm metallic accents against cool, deep backgrounds. The terminal/IDE metaphor remains but is executed with restraint — evoking the feel of a premium code editor theme rather than a novelty terminal replica. Every element shares the same warm-cool tension: burnished gold commands attention while soft teal marks secondary signals, all grounded on ink-dark surfaces with a subtle blue undertone.

## Goals

- Present Tyler Xiao as a systems-minded builder through a refined, code-first aesthetic rooted in terminal and IDE metaphors.
- Keep copy and structure concise so recruiters can scan the site in under a minute.
- Provide clear entry points for contacting Tyler, reviewing projects, and exploring deeper write-ups.

## Brand Foundations

- **Voice:** Confident, precise engineer — short declarative sentences with inline `code` snippets for emphasis. No exclamation marks; let the work speak.
- **Imagery:** IDE-inspired panels, command palettes, and syntax-highlighted blocks. Restrained — no neon glows or gratuitous particle effects. Window chrome (title bars, dot indicators) used sparingly as structural cues, not decoration.
- **Grid:** 12-column fluid layout with sections housed inside "panes" featuring minimal window chrome (thin top bar, subtle separators). Generous vertical rhythm between sections (`py-24` / `py-32`).

## Typography

| Role | Font Stack | Details |
| --- | --- | --- |
| Display | `"Clash Display", "Satoshi", system-ui, sans-serif` | Hero headings, nav logotype, section titles. Semi-bold to bold (600–700). Tight tracking (`-0.03em`). Source from [Fontshare](https://www.fontshare.com/fonts/clash-display). |
| Body | `"Satoshi", "General Sans", system-ui, sans-serif` | Paragraphs, links, CTA labels. Regular to medium (400–500). Generous line-height (`1.65`). Source from [Fontshare](https://www.fontshare.com/fonts/satoshi). |
| Mono | `"Monaspace Neon", "Fira Code", Menlo, monospace` | Code snippets, terminal commands, eyebrow labels. Normal case for code blocks; uppercased with wide tracking (`0.08em`) for section eyebrows. Source from [GitHub Monaspace](https://monaspace.githubnext.com). |

**Why these fonts:** Clash Display brings a geometric, commanding presence that feels engineered — not the rounded softness of Space Grotesk. Satoshi is a clean geometric sans that reads beautifully at body sizes without the ubiquity of Inter. Monaspace Neon is GitHub's textured monospace with a distinctive character that elevates code surfaces beyond the usual Fira Code / JetBrains Mono defaults.

**Tailwind setup:** Extend `fontFamily` with `sans` → Satoshi stack, `display` → Clash Display stack, `mono` → Monaspace Neon stack. Load via `@font-face` declarations in `globals.css`. Apply `font-sans` globally, `font-display` on headings and navigation logotype, `font-mono` on code surfaces and label accents.

## Color Palette

| Token | Value | Usage |
| --- | --- | --- |
| `--bg` | `#07080C` | Body background. Deep space black with cool blue undertone — richer than flat `#000`. |
| `--surface` | `#10131A` | Cards, panels, nav bar. One step above background. |
| `--surface-raised` | `#181C27` | Hover states, active panels, modal overlays. |
| `--accent` | `#E8C468` | Primary accent. Buttons, links, highlighted text, active indicators. Warm burnished gold. |
| `--accent-muted` | `rgba(232, 196, 104, 0.12)` | Badge/chip fills, subtle highlight backgrounds. |
| `--secondary` | `#4ECDC4` | Secondary accent. Code syntax highlights, status dots, inline tags. Soft teal. |
| `--secondary-muted` | `rgba(78, 205, 196, 0.10)` | Secondary badge fills, terminal output accents. |
| `--text` | `#E8ECF1` | Primary text. Soft white — not harsh `#FFF`. |
| `--text-muted` | `#6C7689` | Metadata, timestamps, secondary copy. |
| `--divider` | `rgba(232, 196, 104, 0.06)` | Borders, separators. Warm-tinted for palette cohesion. |

**Gradients:** `--accent → --secondary` (`#E8C468 → #4ECDC4`) used sparingly — hero glow, primary button hover shimmer, and timeline node accents. Apply as radial blurs behind focal elements or as directional gradients on interactive surfaces. Never as flat background fills.

**Why this palette:** The purple-green combination in the previous design pulled from two unrelated hues with no tonal bridge. This palette centers on warm-cool tension — gold and teal are complementary, creating natural harmony. The warm gold reads as premium and intentional against cool dark surfaces, while the teal provides contrast without competing. Every derived color (muted fills, dividers) traces back to these two anchors, creating visual unity across the entire interface.

## Layout & Key Sections

1. **Hero**
   - Full viewport height minus nav.
   - Left column: stacked statements styled like commented code (`// hi, i'm tyler`) in mono, leading into a bold display heading set in Clash Display. Subheading in Satoshi, `--text-muted`.
   - Right column: terminal pane showing a cycling JSON/resume snippet or agent log. Syntax highlighting uses `--accent` for keys/strings and `--secondary` for values/booleans.
   - CTA buttons: `Contact` (primary — `--accent` fill, `--bg` text, firm shadow) and `View Past Experience` (secondary — transparent, dashed `--divider` border, `--text-muted` label). Both use mono font for labels.

2. **About Snapshot**
   - Two-column layout; text on left in Satoshi, on the right a "status monitor" card with quick facts as key-value pairs (mono font, `--divider` grid lines, `--secondary` for values).

3. **Experience Timeline**
   - Vertical timeline styled as git commit history: nodes with abbreviated hashes in `--text-muted`, role/company as commit message in `--text`, duration as metadata. Timeline connector uses a thin `--accent` line with a soft glow (`box-shadow: 0 0 8px rgba(232, 196, 104, 0.15)`).

4. **Selected Projects**
   - 2-up grid of code-editor cards: tab header (project name in mono, `--accent`), body with description in Satoshi, and tech tags as chips (`--accent-muted` background, `--accent` text, mono font).

5. **Writing / Speaking**
   - Changelog-style entries: date in `--text-muted` mono, `feat:` keyword in `--secondary`, title in `--text`. Clean left-aligned list.

6. **Contact / Footer**
   - Terminal-style footer with pseudo-commands (`$ connect --via=email`). Command text in mono, interactive spans in `--accent` with underline on hover.

7. **Past Experience Page**
   - Separate route; expanded timeline for every project and role.
   - Filters styled as command palette tags: inactive uses `--surface-raised` fill, active uses `--accent-muted` fill with `--accent` text and border.

8. **Schedule a Call Page**
   - Hero-sized card embedding or linking to Calendly.
   - Supporting bullets styled as terminal output lines with `--secondary` status indicators (`[ok]`).

## Components & Elements

- **Navigation:** Fixed top bar on `--surface` with 1px `--divider` bottom border. Logotype on left in Clash Display (`--text`). Nav links on right in Satoshi medium weight. Active link: `--accent` text with a subtle underline glow (`box-shadow: 0 2px 8px rgba(232, 196, 104, 0.25)`). No keyboard shortcut badges in nav — keep it clean.
- **Badge chips:** Pill-shaped, mono font, small size (12–13px). `--accent-muted` background, `--accent` text, 1px `rgba(232, 196, 104, 0.15)` border. For secondary tags: same pattern using `--secondary-muted` and `--secondary`.
- **Cards:** `rounded-lg`, 1px `--divider` border, layered shadow (`shadow-[0_4px_24px_rgba(0,0,0,0.35),_0_1px_2px_rgba(0,0,0,0.25)]`). Minimal top bar with three small dots in `--text-muted` opacity. Background: `--surface`.
- **Buttons:**
  - Primary: `--accent` fill, `--bg` text (dark on gold), shadow `0 2px 12px rgba(232, 196, 104, 0.2)`. Hover: gradient shifts toward `--secondary`, shadow deepens. No pulsing animations — polish over gimmick.
  - Secondary: transparent, 1px dashed `--divider` border, `--text-muted` text. Hover: border color transitions to `--accent`, text to `--text`.
- **Section headers:** Mono eyebrow label in `--text-muted`, uppercased, tracked (`0.08em`). Main heading in Clash Display, `--text`. Separated by a faint `--divider` rule below the heading.

## Theme Toggle (Light / Dark)

A small circular button fixed to the right edge of the viewport at vertical center. Dark mode is the default.

- **Behavior:** Toggles `data-theme` attribute on `<html>` between `'dark'` and `'light'`. Persists choice in `localStorage`. An inline `<script>` in `<head>` applies the stored theme before first paint to prevent flash.
- **Light palette:** Warm parchment background (`#F6F4EF`), white surfaces, deeper gold accent (`#A07D1C`) and teal (`#168F86`) for text contrast. All tokens adapt via CSS custom properties — no class name changes needed in components.
- **Icon:** Sun icon in dark mode (switch to light), moon icon in light mode (switch to dark). Hover highlights with `--accent`.
- **Terminal:** Always renders with its own dark palette regardless of theme — terminals should stay dark.

## Interaction & Motion

- **Page load:** Staggered fade + translate-up reveals (`motion-safe`). Hero elements enter first (heading → subheading → CTAs → terminal, 80ms stagger). Sections below reveal on scroll.
- **Hover states:** Cards lift with `scale(1.01)` and shadow deepening (no tilt — keep it grounded). Buttons transition color and shadow over 200ms ease.
- **Cursor glow:** A faint `--accent` radial gradient follows the cursor on the hero section only. Implemented via CSS `radial-gradient` repositioned on `mousemove`. Subtle — 400px radius at 6% opacity.
- **Terminal typing:** Hero terminal text types in at 45ms per character with natural pauses at punctuation. Keep total duration under 3s.
- **Accessibility:** Large text contrast >= 3:1, body text >= 4.5:1 against `--bg`. All animations respect `prefers-reduced-motion`. Focus rings use `--accent` with 2px offset.

## 3D & Depth System

All 3D effects use CSS `perspective()` and `transform-style: preserve-3d`. No WebGL or external 3D libraries — everything runs on the GPU via CSS transforms and composited layers. All 3D motion respects `prefers-reduced-motion` and is disabled on coarse pointer (touch) devices.

### Perspective Grid
- A CSS-only infinite grid recedes into the hero background using `perspective: 600px` and `rotateX(65deg)`.
- Grid lines use `--accent` at 6% opacity with a `background-size: 60px 60px` repeating pattern.
- Masked with `linear-gradient` so it fades to nothing before midscreen. Grid scrolls vertically via `@keyframes grid-scroll` (20s loop) for a subtle "approaching horizon" effect.
- Hidden on mobile (`max-width: 900px`) and `prefers-reduced-motion`.

### Floating Depth Orbs
- Three `position: fixed` blurred radial gradients (`filter: blur(80px)`) drift slowly via `@keyframes orb-drift` at different durations (18s, 22s, 28s).
- Each orb parallax-shifts on scroll at different rates (`0.02`, `-0.015`, `0.025`) using `translate3d` driven by `scrollY`, creating layered depth as the user scrolls.
- Uses `--accent` and `--secondary` colors at low opacity so they adapt to light/dark themes.

### 3D Card Tilt
- **Profile shell:** `perspective(900px)` with `rotateX`/`rotateY` driven by mouse position. Tilt range increased to ±12° (from ±8°). Includes a `::after` pseudo-element for a glass-like reflection glare that shifts with tilt. `transform-style: preserve-3d` enables the floating badge at `translateZ(40px)`.
- **Project cards:** Same tilt system at ±10° with `preserve-3d`. Internal layers (`.project-tab` at `translateZ(8px)`, `.project-body` at `translateZ(4px)`) create parallax depth within the card. A `::after` edge-highlight reflection layer appears on hover.
- **Status card:** Lighter tilt at ±8° with its own CSS custom properties (`--card-tilt-x`, `--card-tilt-y`).

### 3D Reveal Animations
Two new reveal variants supplement the existing `reveal` class:
- **`reveal-3d`:** Elements enter with `perspective(800px) rotateX(8deg) translateY(30px) scale(0.97)` and settle to neutral. Used on project cards and the status monitor. Origin is `bottom center` for a "rising from the page" feel.
- **`reveal-flip`:** Elements enter with `perspective(600px) rotateY(-12deg) translateX(-20px)` for a side-door effect. Used on timeline items.

### Hero Text Depth
- The `.highlight` span on "Agents" uses layered `text-shadow` to create a subtle 3D extrusion: two warm `--accent` shadows at 1px and 2px offset plus a deeper ambient shadow. On hover, the extrusion deepens to 4px with a lift (`translateY(-2px)`).
- Light theme reduces the extrusion to a single subtle shadow for readability.

### Terminal Depth
- The terminal tilts slightly on hover: `perspective(800px) rotateX(-1deg) translateY(-2px)` with a deeper shadow. Creates the impression of the terminal surface lifting toward the viewer.

### Timeline Glow
- A `::after` pseudo-element on `.timeline` creates a traveling glow — a thin 40px-tall gradient bar that animates from top to bottom over 4s, giving the timeline connector a "data flowing" feel.

### Grain Overlay
- A full-viewport `position: fixed` layer using an inline SVG `feTurbulence` noise pattern at 2.8% opacity with `mix-blend-mode: overlay`. Adds film-grain texture to all surfaces. Light theme uses `multiply` blend at 3.5% opacity.

### Button Shimmer
- Primary button has a `::after` pseudo with a diagonal `linear-gradient` highlight that sweeps left-to-right on hover (500ms). Creates a polished "catch the light" shimmer.

### Performance Notes
- All 3D transforms target `transform` and `opacity` only — no layout thrash.
- `will-change: transform, opacity` on orbs; all tilt handlers are `requestAnimationFrame`-throttled.
- Orbs and grid are hidden via `display: none` in `prefers-reduced-motion`, not just frozen.

## TODO — Actionable Diff (Mockup → Live Site)

Items are grouped by file. Check off as completed.

### `globals.css` — 3D & Depth Additions

- [ ] **Grain overlay class.** Add `.grain-overlay` (fixed, inset, `feTurbulence` SVG noise, 2.8% opacity `mix-blend-mode: overlay`; light theme uses `multiply` at 3.5%). The live site has no texture layer.
- [ ] **Floating depth orbs.** Add `.depth-orb`, `.depth-orb--1/2/3` classes — fixed blurred radial gradients with `@keyframes orb-drift` (different durations: 18s/22s/28s). Hidden on `prefers-reduced-motion`.
- [ ] **Hero perspective grid.** Add `.hero-grid-bg` + `.hero-grid-plane` — CSS-only infinite receding grid (`perspective: 600px`, `rotateX(65deg)`, `@keyframes grid-scroll` 20s loop). Masked with gradient fade. Hidden below 900px.
- [ ] **Hero cursor glow.** Add `.hero-cursor-glow` — a 400px blurred `--accent` radial gradient that follows the mouse via JS. The live site has pointer glow on cards but not a freeform hero glow.
- [ ] **3D reveal variants.** Add `.reveal-3d` (`perspective(800px) rotateX(8deg) translateY(30px) scale(0.97)`, origin `bottom center`) and `.reveal-flip` (`perspective(600px) rotateY(-12deg) translateX(-20px)`). Wire into `useRevealOnScroll` selector.
- [ ] **Hero text extrusion.** Add layered `text-shadow` on `.hero-heading .highlight` (two warm `--accent` shadows at 1–2px + ambient). Hover deepens to 4px with `translateY(-2px)`. Light theme: single subtle shadow.
- [ ] **Terminal 3D hover.** Add `perspective(800px) rotateX(-1deg) translateY(-2px)` + deeper shadow on `.terminal:hover` / `[data-terminal-shell]:hover`.
- [ ] **Timeline glow bar.** Add `::after` on `.timeline-motion` — a traveling 40px gradient bar animating top-to-bottom over 4s (`@keyframes timeline-glow`).
- [ ] **Status card 3D tilt.** Add `--card-tilt-x`/`--card-tilt-y` custom properties and `perspective(700px)` transform on the status monitor pane. Add a pulsing live indicator dot (`.status-card-header::before`, `@keyframes status-pulse`).
- [ ] **Project card enhancements.** Add `::after` edge-highlight reflection layer (subtle diagonal gradient, `opacity: 0` → `1` on hover). Add `.project-tab-dot` glow on hover (`box-shadow` with `--accent`). Increase tilt from ±6° to ±10° in `usePointerGlow` call.
- [ ] **Button shimmer.** Add `::after` on `.btn-primary` — diagonal `linear-gradient` highlight sweep left-to-right on hover (500ms transition).
- [ ] **Status row hover.** Add `background: color-mix(in srgb, var(--accent) 3%, transparent)` on status card row hover.
- [ ] **Changelog item hover.** Add `transform: translateX(4px)` on `.changelog-item:hover` / writing entries on hover.
- [ ] **Project link arrow gap.** Change `hover:opacity-75` to `gap` animation (`gap: 6px → 10px`) on project card "View project" links.
- [ ] **Contact link lift.** Add `transform: translateY(-1px)` on `.contact-elsewhere a:hover`.
- [ ] **Update `prefers-reduced-motion` block.** Add the new animation/transition selectors (`.reveal-3d`, `.reveal-flip`, `.depth-orb`, `.hero-grid-plane`, `.grain-overlay`, `.timeline::after`, etc.) to the disabled list.

### `app/layout.tsx` — Grain & Orbs Markup

- [ ] **Add ambient DOM elements.** Insert grain overlay `<div>` and three depth orb `<div>`s as first children of `<body>`, so they appear on all pages. These are `aria-hidden`, `pointer-events: none`, `position: fixed`.

### `components/HomeMotionEffects.tsx` — New JS Behaviors

- [ ] **Hero cursor glow.** Add `mousemove` listener on `.hero` / hero `<section>` that repositions a `#heroCursorGlow` element (CSS `left`/`top` with `translate(-50%, -50%)`). Disabled on coarse pointer and reduced motion.
- [ ] **Status card tilt.** Add a new `usePointerGlow` call targeting the status monitor card (`[data-pointer-status]` or similar), with `maxTilt: 8` and custom property names `--card-tilt-x`/`--card-tilt-y`.
- [ ] **Scroll parallax for orbs.** Add a `scroll` listener (rAF-throttled) that applies `translate3d(0, scrollY * rate, 0)` to each `.depth-orb` at different rates. Disabled on reduced motion.
- [ ] **Wire 3D reveal classes.** Extend `useRevealOnScroll` call to also observe `.reveal-3d, .reveal-flip` selectors (or update the selector string to `'.reveal-on-scroll, .reveal-3d, .reveal-flip'`).
- [ ] **Increase profile tilt.** Change `maxTilt: 8` → `maxTilt: 12` on the profile shell `usePointerGlow` call.
- [ ] **Increase card tilt.** Change `maxTilt: 6` → `maxTilt: 10` on the project card `usePointerGlow` call.

### `app/page.tsx` — Markup Changes

- [ ] **Hero cursor glow element.** Add `<div className="hero-cursor-glow" id="heroCursorGlow" aria-hidden="true" />` inside the hero `<section>`.
- [ ] **Hero grid background.** Add perspective grid markup (`<div className="hero-grid-bg"><div className="hero-grid-plane" /></div>`) as first child of hero section.
- [ ] **Profile floating badge.** Add `<span className="profile-badge">sidequesting</span>` inside the profile shell div (needs `transform-style: preserve-3d` on parent, badge at `translateZ(40px)` with `@keyframes badge-float`).
- [ ] **Profile shell reflection.** The `profile-halo-shell` class needs a `::after` glare layer in CSS — no markup change, just the CSS addition.
- [ ] **Swap reveal classes on project cards.** Replace `reveal-on-scroll` with `reveal-3d` on project card articles.
- [ ] **Swap reveal classes on status card.** Replace `reveal-on-scroll reveal-slide-right` with `reveal-3d` on the status monitor pane.
- [ ] **Swap reveal classes on timeline items.** Replace `reveal-on-scroll reveal-slide-left/right` with `reveal-flip` on timeline entries.
- [ ] **Add status card data attribute.** Add `data-pointer-status` to the status monitor pane so the new tilt hook can target it.

### Design Improvements — Visual Polish

- [ ] **Nav active link glow.** Add `box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 25%, transparent)` to the nav indicator bar. The mockup has a subtle underline glow; the live site has a flat 2px bar.
- [ ] **Card shadow depth in light theme.** Current light-theme card shadow is very faint (`0.06` alpha). Increase to `0 4px 24px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)` for more perceived depth.
- [ ] **Body `overflow-x: hidden`.** The mockup sets this to prevent horizontal scroll from the 3D grid and orbs. Add to the live `body` styles.
- [ ] **Selection highlight.** Already in `globals.css` — good.
- [ ] **Timeline entry border.** In the mockup, timeline items have a visible `1px solid var(--divider)` border at rest. The live site uses `border: 1px solid transparent`. Consider matching the mockup for more structure.
- [ ] **Hero section `position: relative; overflow: hidden`.** Needed to contain the perspective grid and cursor glow. Add to the hero section wrapper.

### Fonts — Status

Fonts are already loaded correctly in `globals.css`:
- Clash Display + Satoshi via Fontshare CDN `@import`
- Monaspace Neon via `@font-face` from jsDelivr
- CSS variables `--font-display`, `--font-sans`, `--font-mono` are set and wired into Tailwind v4 `@theme`

No font changes needed. The mockup and live site use identical stacks.
