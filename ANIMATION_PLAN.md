# Personal Website Animation Plan

## Goal

Add richer, personal-feeling motion and interaction across the site without making it feel gimmicky or slowing it down.

## Motion Direction

- Tone: terminal-native, precise, and technical with warm accent highlights.
- Interaction model: animations should respond to user intent (scroll, hover, pointer movement, theme switch, terminal commands), not run constantly.
- Rule: every motion should either improve clarity, provide feedback, or add personality.

## Proposed Animations and Interactions

### 1) Hero + First Impression

- Add a staged page-load reveal for hero text, CTA buttons, and profile image (short stagger, subtle upward drift, fade-in).
- Add a pointer-reactive halo behind the profile image that follows cursor position.
- Add a gentle image parallax tilt on desktop, disabled on touch devices and reduced-motion mode.
- Add a terminal glow pulse tied to first user interaction (first scroll or first click) to make the interface feel alive.

### 2) Terminal as Personal Interaction Hub

- Animate command output line-by-line for selected commands (`about`, `projects`, `experience`) to mimic typed system responses.
- Add command acknowledgement micro-feedback (prompt flash + tiny shake on invalid command).
- Add lightweight “quick command chips” above the input that animate on hover and inject commands on click.
- Add optional one-time “Tip” banner with animated entrance: “Try `help` or `cat resume.pdf`”.

### 3) Experience Timeline

- Add scroll-reveal animation for each timeline entry with alternating x-offset and fade.
- Animate timeline nodes to activate as entries enter viewport (accent glow + scale).
- Add hover focus mode: hovered card increases contrast while neighboring cards soften slightly.

### 4) Project Cards

- Add pointer-tracked radial highlight on each card (follows cursor inside card bounds).
- Add subtle 3D tilt on hover for desktop.
- Animate tech chips with delayed pop-in on card hover.
- Keep current hover scale but replace abrupt transitions with eased spring-like timing.

### 5) Writing + Contact Sections

- Add underline sweep animation on post links on hover/focus.
- Add contact link “status ping” dot animation on hover to reinforce terminal-style affordance.
- Add visitor count number-roll animation when data resolves from loading state.

### 6) Global UI Polish

- Add animated active indicator in navbar on route changes.
- Upgrade theme toggle with icon morph + brief background flash transition.
- Add reusable scroll-reveal utility class for all major sections (single source of truth).

## Technical Implementation Strategy

- Prefer native CSS transitions/animations + `IntersectionObserver` + React hooks (no heavy dependency required).
- Build reusable utilities:
  - `useRevealOnScroll` hook for section/card entrance.
  - `usePointerGlow` hook for cursor-reactive highlights.
  - shared `motion-safe` helpers in `app/globals.css`.
- Keep timing tokens centralized (`--motion-fast`, `--motion-base`, `--motion-slow`) for consistency.

## Accessibility and Performance Guardrails

- Full `prefers-reduced-motion` support: disable transforms/auto-playing sequences and keep instant state changes.
- Ensure focus-visible states receive same feedback as hover interactions.
- Use transform/opacity-based animation only (avoid layout-thrashing properties).
- Throttle pointer-driven effects with `requestAnimationFrame`.
- Target 60fps on modern devices; no blocking main-thread animations.

## Delivery Phases

1. Foundation: motion tokens, reduced-motion handling, reusable reveal/pointer hooks.
2. Core personality pass: hero, terminal interactions, timeline reveals.
3. Secondary polish: project card effects, writing/contact micro-interactions, theme toggle/nav indicator.
4. QA + tuning: mobile/touch behavior, reduced-motion audits, performance pass.

## Approval Questions

- Keep this dependency-free (CSS + hooks), or are you open to adding `framer-motion` for more expressive sequencing?
- Do you want the terminal command animation to feel realistic (slower, more theatrical) or snappier (faster, productivity feel)?
