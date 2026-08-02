# Concept directions — design

**Status:** superseded in part. Round two (2026-07-29) replaced Archive and Press on the
board with three data-driven directions — see "Round two" at the end of this document.
Live at `/concept` (comparison board).

## Why the previous concept was replaced

The original `/concept` was not "SaaS" so much as the stock agency-portfolio template. It hit nearly every default move at once:

- Cream paper (`#e9e4db`) with a rust accent (`#c84f32`)
- Serif display headline whose second line is a muted italic
- Mono uppercase letterspaced kickers on every section
- A four-up tab bar filling the viewport, active tab as an inverted ink block
- An infinite marquee of employer names
- A numbered project grid with `01/02/03` badges and a big-then-small split
- A fake browser chrome with three dots

Any one is fine. All seven together is the template. Replaced rather than patched.

## What was built

Three directions, same content, so they can be compared rather than imagined. All three
use `three` / `@react-three/fiber` / `@react-three/drei`, which were already in
`package.json` and previously unused — no new dependencies.

### A — Observatory (`/concept/observatory`)

The page as a measuring instrument.

- **Object:** a six-ring armillary armature in one persistent `<Canvas>`, fixed behind
  all content and never remounted. The ring pool is constant; each view rearranges the
  same six rings — nested for profile, coplanar discs for work, scattered and precessing
  for signals, stacked on a vertical axis for history.
- **Motion:** view changes are camera transits, not crossfades. Numeric readouts scramble
  to their new values. Cursor drives ±4° parallax, scroll drives camera elevation.
  Hovering a DOM plate lights the matching ring in WebGL.
- **Type:** mono only. No serif anywhere, `tabular-nums` throughout.
- **Palette:** `#0a0b0d` ground, `#74e0e8` signal — deliberately cold, since the real
  site owns warm dusk/brass.

### B — Archive (`/concept/archive`)

The object is the navigation.

- **Object:** a stratified monolith of six slabs. Drag to turn it; a flick carries
  momentum and settles onto the nearest of four faces, and the face you land on _is_ the
  view. Nav buttons and the comparison board turn it from the other direction.
- **Motion:** weighted drag with inertia and face snapping. Everything else is slow.
- **Type:** IBM Plex Sans, large and sparse. Mono only in the rails.
- **Palette:** `#08090a` and bone `#e8e3d9`. No accent colour at all.

### C — Press (`/concept/press`)

Print logic on screen.

- **Object:** a flat black orthographic solid — a different geometry per view, swapped
  with a hard cut rather than a morph. Rotation is quantised to 15° steps six times a
  second, like a plate indexing.
- **Motion:** stepped and abrupt. `steps()` timing, no easing curves anywhere.
- **Type:** oversized grotesque masthead trimmed by the page edge, not fitted to it.
- **Palette:** `#f4f2ed` paper, `#0c0c0c` ink, `#ff3b1f` accent. Nothing rounded.

### The board (`/concept`)

Three live previews side by side, each rendering at true device width and scaled down, so
the comparison is of real layouts rather than responsive fallbacks. A shared view selector
drives all three at once over `postMessage`, so transits can be watched simultaneously
without reloading the frames. Desktop/mobile toggle; each preview links to its full page.

## Content decisions

All real content is preserved. Three stock moves were replaced:

- **Employer marquee → static tabular log.** An infinite logo strip is the loudest
  template tell.
- **Disabled "Connect music later" button → an explicit empty channel.** A dead disabled
  control is worse than nothing. Each concept states the absence in its own voice
  (`NO SIGNAL`, a plain sentence, `NO ROTATION ON FILE`) rather than inventing a taste
  section.
- **Fake browser chrome → the era read off the 3D object.**

## Structure

```
components/concept/
  conceptData.ts          shared content (unchanged)
  conceptRegistry.ts      the three directions, for the board
  conceptViewStore.ts     hash-backed view state + the board's postMessage bridge
  shared/runtime.ts       damping maths, external-store hooks
  observatory/  Observatory.tsx  Armature.tsx  armatureStore.ts  Readout.tsx  views.tsx
  archive/      Archive.tsx      Monolith.tsx  monolithStore.ts
  press/        Press.tsx        PressObject.tsx
  compare/      CompareBoard.tsx
```

Frame-level mutable state (camera telemetry, hover focus, monolith physics) lives in
module stores rather than React state or refs threaded through props — sixty updates a
second should not be renders, and the repo's ESLint config forbids `useEffect` in favour
of `useSyncExternalStore` boundaries. Subscriptions that exist only for their side effect
go through the same boundary.

## Scope

Throwaway visual studies. Reduced-motion is honoured in all three (the motion is
aggressive enough that it is a comfort issue, not a checkbox), WebGL simply does not mount
if unavailable and the chrome stands alone, and mobile drops the pointer parallax. No
other edge-case work; the only test is the existing data contract, extended to cover the
registry. The homepage is untouched.

## Round two (2026-07-29)

All three round-one concepts shared one flaw: the centerpiece was an abstract sculpture
(rings, slabs, a solid) and the real content sat in DOM plates beside it. Swap in anyone
else's resume and nothing on screen changes but the text. Round two inverts the
principle — **every animated element must be built from the real profile data;
anything that survives a resume-swap fails.** Archive (B) and Press (C) were retired
from the board; Observatory (A) stays for comparison. Their pages remain reachable
by URL.

Built from briefs in `docs/superpowers/specs/2026-07-29-{bench,evalrun,museum}-brief.md`
by codex `gpt-5.6-sol` subagents inside a Claude workflow (implement → adversarial
audit → fixes through the same codex thread).

### D — Bench (`/concept/bench`)

Product photography as interface. A studio workbench in one persistent Canvas carries
real device objects whose screens are textured with the actual shipped screenshots
(`public/projects/*.png`). Experiments are unfinished blank devices; history is six
screen generations built from the `gitEras` palettes. Light studio greys; the
screenshots are the only color on the page.

### E — Eval Run (`/concept/evalrun`)

The profile as a benchmark harness executing. Four suites compiled from the data —
identity, shipped, inflight, regression — stream cases with deterministic FNV-1a-hashed
durations. Projects pass and emit their screenshots as artifacts; experiments honestly
map Shipping/Measuring/Collecting to PASS/RUNNING/PENDING. No WebGL; CI-dashboard
information design, not terminal cosplay.

### F — Museum (`/concept/museum`)

The site as its own museum. Six living DOM miniatures of the actual past homepages,
rebuilt from the real commits (`git show` against `gitEras` hashes), on a weighted
timeline scrub. The museum chrome has no color of its own — the active era recolors
the page. Projects hang as a salon wall; experiments are crated exhibits in a wing
under construction.

The board at `/concept` now compares four directions; `conceptData.test.mts` covers the
four-entry registry. `tsconfig.json` gained `allowImportingTsExtensions` so the node
test runner's `.ts` imports typecheck.
