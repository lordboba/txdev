# Personal Website Design

## Aesthetic Direction — "Monochrome Spatial Interface"

A black-and-white motion language that adapts by theme:
- Dark mode: white motion on black surfaces.
- Light mode: black motion on white surfaces.

The color palette for content can still carry brand accents where useful, but **all animated atmospheric elements** should use monochrome ink values only.

## Goals

- Replace per-section colored gradients and branded ambient effects with a cohesive monochrome motion system.
- Introduce a hero-grade, interactive 3D tetrahedron as the signature visual.
- Keep the interface readable, fast, and accessible across desktop and mobile.

## Visual System

### Core Theme Logic

- `data-theme='dark'`: animation ink derives from white (`rgba(255,255,255,...)`).
- `data-theme='light'`: animation ink derives from near-black (`rgba(15,18,25,...)`).
- Motion tokens:
  - `--motion-ink`
  - `--motion-ink-soft`
  - `--motion-ink-faint`

### Surfaces

- Body background remains clean and low-noise.
- Any glow, halo, pulse, or moving gradient must be computed from `--motion-ink*` tokens.
- Avoid gold/teal animated gradients for background ambiance.

## Hero Signature: 3D Tetrahedron

### Component

- Add a dedicated hero background component that renders a projected tetrahedron.
- Render using a lightweight canvas loop (no heavy 3D dependency required).
- Draw faces + wire edges with subtle depth sorting and monochrome transparency.

### Motion Behavior

- Continuous spin driven by time.
- Pointer influence adds slight axis drift while hovering the hero zone.
- Scroll subtly shifts projection depth/center so the object feels spatially connected to page movement.
- Respect `prefers-reduced-motion`: render static frame and disable continuous animation.

### Layering

- Tetrahedron scene sits behind hero content (`z-index` below text/buttons/portrait).
- Hero section uses `isolation: isolate` to contain blend/depth effects.

## Interactive Slider (Following Down the Page)

### Control UX

- Add one vertical control rail fixed near right viewport edge.
- Slider controls tetrahedron spin intensity (`0–100%`).
- Rail drifts slightly downward with scroll progress to feel attached to page flow.

### Styling

- Pill shell with mono label (`SPIN`) and compact value readout.
- Track and thumb are monochrome and theme-aware.
- Track fill can visualize scroll progress with a top-down fill segment.

### Mobile

- Hide the floating slider under `max-width: 900px`.
- Keep tetrahedron present but visually restrained.

## Animation Refactor Rules

Convert these animations to monochrome behavior:
- Hero emphasis text depth shadow.
- Profile/halo pointer glow.
- Timeline active glow and node pulse.
- Status pulse + contact ping dot.
- Project-card pointer highlight glow.
- Theme flash overlay.

Keep non-animated semantic brand colors where they add clarity (links, tags, CTAs), unless later intentionally refactored.

## Accessibility and Performance

- Use only transform/opacity/canvas draw; avoid layout-thrashing properties.
- Disable heavy animation when `prefers-reduced-motion: reduce`.
- Maintain accessible contrast in both themes.
- Ensure control elements are keyboard reachable and labeled.
- Cap canvas DPR to avoid wasteful overdraw.

## Implementation Mapping

- `app/page.tsx`
  - Mount tetrahedron component in hero.
  - Remove old hero grid/cursor-glow markup.
  - Shift timeline line/node to shared monochrome CSS classes.

- `components/TetrahedronField.tsx`
  - New component: projected tetrahedron + slider control + theme observer.

- `components/HomeMotionEffects.tsx`
  - Remove old hero cursor-glow and orb parallax logic.
  - Keep reveal, pointer-tilt, timeline focus, terminal wake logic.

- `app/globals.css`
  - Add monochrome motion tokens.
  - Add tetrahedron and slider styles.
  - Remove depth orb / hero grid / cursor glow blocks.
  - Convert animation-related accents to `--motion-ink*` variables.

## QA Checklist

- Dark mode: white motion on black backgrounds.
- Light mode: black motion on white backgrounds.
- Slider updates tetra spin in real time.
- Slider rail appears to follow page scroll.
- No colored ambient animation remnants remain.
- Mobile layout remains clean and uncluttered.
- Reduced-motion mode disables continuous scene animation.
