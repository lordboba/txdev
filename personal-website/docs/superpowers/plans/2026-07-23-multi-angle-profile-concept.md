# Multi-Angle Profile Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated `/concept` route that lets Tyler review a cinematic personal profile, shipped-work view, experiments-and-music view, and a curated Git-era timeline without replacing the current homepage.

**Architecture:** Keep all concept-specific content in a typed data module and render it through one client-side experience with four selectable views. Use a CSS Module for the visual system and motion so the prototype adds no dependencies and cannot leak styles into the existing site. The route itself remains a small server component that provides metadata.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind-compatible global tokens, CSS Modules, Node test runner.

---

### Task 1: Define the concept content model

**Files:**

- Create: `components/concept/conceptData.ts`
- Create: `components/concept/conceptData.test.mts`

- [ ] **Step 1: Write the failing data-contract test**

Create a Node test that imports the concept data and asserts that view IDs are unique, every Git era has a real commit hash and date, and every featured project has an image and link.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test components/concept/conceptData.test.mts`

Expected: FAIL because `conceptData.ts` does not exist.

- [ ] **Step 3: Implement the typed data module**

Add the four view definitions, real experience and project selections from `lib/siteData.ts`, personal facts from the introductory blog post, explicit empty-state copy for music preferences that are not yet present in the repository, and curated Git eras from the repository history.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test components/concept/conceptData.test.mts`

Expected: PASS with three data-contract tests.

### Task 2: Build the interactive concept

**Files:**

- Create: `components/concept/ProfileConcept.tsx`
- Create: `components/concept/ProfileConcept.module.css`
- Create: `app/concept/page.tsx`

- [ ] **Step 1: Create the route shell**

Add `/concept` metadata and render the isolated client component.

- [ ] **Step 2: Implement angle navigation**

Use semantic buttons, URL hash synchronization, arrow-key navigation, focus-visible states, and a compact progress indicator. The four modes must work without changing the current homepage.

- [ ] **Step 3: Implement the cinematic profile and work views**

Compose the existing portrait assets, company history, and selected project screenshots into asymmetric layouts with transform-and-opacity motion only.

- [ ] **Step 4: Implement experiments, music, and Git-era views**

Show real experiment candidates, an honest music empty state, and a curated timeline whose era selector changes the preview treatment without claiming to restore repository state.

- [ ] **Step 5: Add responsive and reduced-motion behavior**

Collapse to one column below 768px, avoid horizontal page overflow, disable nonessential animation under `prefers-reduced-motion`, and keep all interactive controls at least 44px high.

### Task 3: Verify the prototype

**Files:**

- Modify only if verification exposes a defect.

- [ ] **Step 1: Run focused data tests**

Run: `node --test components/concept/conceptData.test.mts`

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: zero ESLint errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js builds `/concept` successfully.

- [ ] **Step 4: Inspect the rendered route**

Start the development server, open `/concept` at desktop and mobile widths, exercise all four angle selectors, and verify the browser console has no errors.

- [ ] **Step 5: Review scope and quality**

Confirm the homepage is unchanged, no third-party dependency was introduced, all claims are based on repository content, the music section is explicitly an empty state, and the Git timeline is presented as a curated preview rather than a destructive reset control.
