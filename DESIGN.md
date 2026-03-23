# Personal Website Design

## Aesthetic Direction — "Spatial Carousel Interface"

A dark, immersive single-viewport app that centers on a 3D rotating carousel for navigation. The interface feels like a spatial OS — content emerges from the carousel rather than scrolling through sections.

Multiple color themes are available:
- **Mono** (default): white accents on dark surfaces.
- **Ember**: warm orange accents.
- **Ice**: cool blue accents.
- **Terminal**: green accents.

## Goals

- Replace the traditional scrolling page layout with a single-viewport spatial UI.
- Use a 3D carousel as the primary navigation element.
- Keep the interface immersive, fast, and accessible across desktop and mobile.
- Support multiple color themes via a bottom theme bar.

## Visual System

### Color Theme Logic

- Themes are set via `data-color-theme` attribute on `<html>`.
- Theme tokens:
  - `--c-accent` — primary accent color
  - `--c-accent-soft` — low-opacity accent for backgrounds
  - `--c-accent-border` — subtle accent for borders
  - `--c-glow` — glow/shadow accent
  - `--c-dot` — status dot color
- Theme selection persists in `localStorage`.

### Surfaces

- App shell fills the full viewport (`height: 100vh`, `overflow: hidden`).
- Background is clean with no ambient gradient blobs on the main page.
- Blog pages use subtle radial gradients derived from `--motion-ink`.

## App Shell Layout

### Structure

- **Topbar**: TX logo (left), visitor count pill + terminal link (right).
- **Main area**: SceneRing background + Carousel3D + ContentPanel.
- **Bottom bar**: ThemeBar with color swatch selectors.

### Topbar

- Minimal header with logo, animated visitor count, and terminal page link.
- No traditional nav links — the carousel serves as navigation.

## Hero Signature: 3D Wire Ring

### Component — `SceneRing.tsx`

- Background decoration rendered with `@react-three/fiber` and Three.js.
- Three overlapping wire rings (circle geometries) with different rotations.
- Monochrome white lines at very low opacity (0.02–0.06).

### Motion Behavior

- Continuous slow rotation driven by `useFrame`.
- No pointer interaction — purely ambient.
- Dynamically imported with `next/dynamic` (SSR disabled).

### Layering

- Ring scene sits behind all content in the main area.
- Positioned absolute, full viewport coverage.

## 3D Carousel Navigation

### Component — `Carousel3D.tsx`

- Five sections arranged in a CSS 3D ring: Home, About, Projects, Blog, Contact.
- Cards use `rotateY` + `translateZ` to form a circular layout.
- Each card shows an icon/gradient or profile photo (Home card).

### Interaction

- Drag to rotate — pointer capture with velocity-based momentum.
- Spring animation snaps to nearest card on release.
- Click front card to select (opens ContentPanel); click non-front card to rotate to it.
- Auto-rotation starts after 2s idle, pauses on interaction, resumes after 4s idle.

### Navigation Dots

- Row of labeled dot-buttons below the carousel.
- Active dot highlighted with accent underline; selected dot shows accent color.
- Clicking a dot rotates to that section and selects it.

## Content Panel

### Component — `ContentPanel.tsx`

- Slides down below the carousel when a section is selected.
- Displays section-specific content (Home, About, Projects, Blog, Contact).
- Max height 320px with scroll, rounded card with glassmorphism.
- Close button in top-right corner.

### Section Content

- **Home**: Avatar, name, subtitle, quick links to timeline and schedule.
- **About**: Quick facts table, recent experience peek, link to full timeline modal.
- **Projects**: 2×2 grid of project cards (first 4), expand button to all-projects modal.
- **Blog**: Description + link to `/blog`.
- **Contact**: Contact links list + schedule-a-call button.

## Modal System

### Component — `Modal.tsx`

- Generic modal with backdrop blur, slide-up animation, ESC to close.
- Header with title + close button, scrollable body.
- Used for detailed views that don't warrant a page navigation.

### Modal Types (in `page.tsx`)

- **TimelineModal**: Full experience timeline with focus area chips, experience cards, and project grid.
- **AllProjectsModal**: Full project grid with image slots, descriptions, and tech chips.
- **ScheduleModal**: Calendly embed, call highlights, social proof section.

## Theme Bar

### Component — `ThemeBar.tsx`

- Fixed at the bottom of the viewport.
- Four color swatch buttons (Mono, Ember, Ice, Terminal).
- Active swatch gets accent border + glow.
- Hover shows tooltip label; hover scales swatch up.
- Selection persists to `localStorage`.

## Blog Pages

### Layout — `blog/layout.tsx`

- Dedicated `blog-shell` layout wrapper with ThemeBar at bottom.
- Separate from the main app shell (no carousel on blog pages).

### Blog Index — `blog/page.tsx`

- Sticky topbar with back-to-site link and "Blog" title.
- Hero section with title and description.
- Card-based post list with date, read time, title, excerpt, and tags.

### Blog Post — `blog/[slug]/page.tsx`

- Sticky topbar with back-to-posts and home links.
- Article header with metadata, title, excerpt, and tags.
- Prose content area with existing `blog-prose` styles.

## Visitor Count

### Component — `VisitorCount.tsx`

- Compact pill in the topbar showing animated visit count.
- Fetches from `/api/user-count` on mount.
- Count animates up with eased cubic timing.
- Respects `prefers-reduced-motion` (skips animation).
- Pulsing green dot indicator.

## Accessibility and Performance

- Three.js scene capped at 1.5x DPR to avoid overdraw.
- SceneRing lazy-loaded via `next/dynamic` (no SSR).
- Modal traps focus and locks body scroll.
- All interactive elements are keyboard reachable.
- Carousel supports pointer events (drag) with proper capture.
- Visitor count animation respects reduced-motion preference.

## Implementation Mapping

- `app/page.tsx`
  - Client component with carousel, content panel, and modal state management.
  - Mounts SceneRing, Carousel3D, ContentPanel, ThemeBar.
  - Three modal components: TimelineModal, ScheduleModal, AllProjectsModal.

- `components/Carousel3D.tsx`
  - 3D carousel with drag, momentum, auto-rotate, and snap-to-card logic.
  - Exports `SECTIONS` array and `Section` type.

- `components/ContentPanel.tsx`
  - Section-specific panel renderer with Home/About/Projects/Blog/Contact views.

- `components/SceneRing.tsx`
  - Three.js wire ring background using `@react-three/fiber`.

- `components/ThemeBar.tsx`
  - Color theme selector with localStorage persistence.

- `components/Modal.tsx`
  - Generic modal with backdrop, ESC handling, and scroll lock.

- `components/VisitorCount.tsx`
  - Animated visitor counter pill with API fetch.

- `app/blog/layout.tsx`
  - Blog-specific shell layout with ThemeBar.

- `app/globals.css`
  - Color theme token definitions (`data-color-theme` variants).
  - App shell, topbar, carousel, content panel, modal, theme bar styles.
  - Blog shell, topbar, card, and article styles.

## QA Checklist

- All four color themes apply consistently across components.
- Carousel drags, snaps, and auto-rotates smoothly.
- Clicking a carousel card opens the correct content panel.
- Content panel scrolls internally and closes cleanly.
- Modals open/close with animation, ESC key, and backdrop click.
- Calendly embed loads in schedule modal.
- Blog pages use dedicated layout with back navigation.
- Visitor count animates on load.
- Mobile layout degrades gracefully (carousel radius adjusts).
- SceneRing renders without blocking SSR.
