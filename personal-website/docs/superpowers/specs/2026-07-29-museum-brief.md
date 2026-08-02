# Concept F — Museum (`/concept/museum`) — implementation brief

## Thesis

The site is its own museum. The centerpiece is the **actual history of this
repository**: six eras of this website's homepage, recreated as living miniatures you
scrub through. Nobody else has this data — it is self-evidently Tyler's. The museum
chrome has **no color of its own**; the active era recolors the page.

## Prime directive (anti-slop)

Every exhibit must derive from `components/concept/conceptData.ts`, real assets in
`public/`, or the **real git history of this repo**. **If an element would survive
swapping in someone else's resume unchanged, it fails.** No abstract geometry, no
particle fields, no invented eras, no marquees, no `01/02` badges, no fake browser
chrome around the miniatures — they are exhibits, not screenshots in frames of lies.

## Study first (read these before writing code)

- `components/concept/conceptData.ts` — `gitEras` has the six commits. The only content source.
- `components/concept/conceptViewStore.ts` — `useConceptView()` / `setConceptView()`.
- `components/concept/shared/runtime.ts` — `damp`, `useMounted`, `usePrefersReducedMotion`.
- `components/concept/observatory/` + `app/concept/observatory/page.tsx` — structure/route reference ONLY.

**Then study the real eras.** For each commit in `gitEras`, inspect the actual
homepage of that era with READ-ONLY git commands, e.g.:

```
git show 96ccd76 --stat
git show 96ccd76:app/page.tsx
git ls-tree -r --name-only 96ccd76 | head -50
```

(Also `79348e8`, `46a72ca`, `4fc5d06`, `daebe22`, `ad3e87a`.) Never `checkout`,
`reset`, `stash`, or any mutating git command. Read enough of each era's homepage
(layout, key components, palette, signature element — e.g. the ASCII terminal banner,
the orbital rings) to build a **faithful** miniature, not a generic placeholder.

## Files you may create (and nothing else)

```
app/concept/museum/page.tsx                   server component, metadata "Concept F · Museum — Tyler Xiao"
components/concept/museum/Museum.tsx          entry, named export `Museum`, 'use client'
components/concept/museum/*                   supporting files; put one miniature component
                                              per era under components/concept/museum/miniatures/
```

**You may NOT edit any existing file.** No new dependencies. Miniatures are **DOM/CSS
recreations** (scaled with `transform: scale()` inside a fixed-aspect stage), not
screenshots and not WebGL — they should feel alive (a blinking cursor in the terminal
era, slow ring rotation in the orbital eras) but be non-interactive.

## The system

- A **timeline scrubber** spanning 2025-11 → 2026-05 with six stops (the real commits,
  labeled `96ccd76 · Foundation` etc.). Drag or click to move between eras; keyboard
  arrows work. Position eases with `damp`.
- The active era's miniature sits center-stage, large; neighboring eras are visible
  small and dimmed at the sides (a gallery wall, not a carousel — no infinite loop,
  hard ends).
- **The page inherits the era's palette.** Museum chrome is neutral
  (`#eceae4` wall, `#1a1917` ink); accents, miniature backgrounds, and the scrubber's
  active marks come from the active era's palette words (parse each `palette` string
  into representative hex values in a small local map). Transitions damp smoothly.
- Each miniature gets a **placard**: catalogue number = the real commit hash, date,
  title, description, `visualLanguage` — set like museum wall text (small, precise,
  no decoration).

## Views (all four, driven by `useConceptView()`)

- **history** — the native, hero view: the full gallery wall + scrubber as described.
- **profile** — "the person behind the commits": `public/pfp.JPG` hung as a portrait
  exhibit with `personalNotes` as its wall text, and `companyRun` as a "on loan to"
  ledger (company / period / detail).
- **work** — "acquisitions": the four `featuredProjects` screenshots hung as framed
  works (thin true frames, correct aspect), each with a placard (title, role,
  description, `accent`, live link). Grid hung at varied sizes like a salon wall, not
  a uniform card grid.
- **signals** — "new wing under construction": the three `experiments` as covered /
  crated exhibits (dust-sheet or crate treatment in CSS), status stenciled on the
  crate (`Shipping` / `Measuring` / `Collecting`), description as a curator's note.

View changes rearrange the same gallery space (damped movement), never remounts.

## Look

- **Type:** museum wall-text conventions — one quiet sans (system stack fine) at
  small sizes with wide measure for placards; era titles may set larger. Mono ONLY
  for commit hashes and dates, `tabular-nums`. Restrained: the miniatures are the
  color and the show; the chrome must stay almost invisible.
- **Motion:** slow and gallery-like everywhere except inside miniatures (each may
  carry one signature idle motion from its era). Scrub is the big interaction —
  weighted, damped, interruptible.

## Hard constraints

- ESLint forbids `useEffect`. Scrub position, palette interpolation, idle animations:
  module store + `useSyncExternalStore` (see `shared/runtime.ts`); rAF loops write to
  the store or CSS custom properties, not React state.
- CSS Modules only; nothing leaks. Era palettes flow through CSS custom properties.
- `usePrefersReducedMotion()`: idle motions stop, scrub snaps instantly.
- Works standalone in an iframe at 1440×900 and 390×844; on mobile the gallery wall
  becomes a vertical walk (scroll between eras), scrubber becomes stop dots.

## Definition of done

- Six recognizable miniatures grounded in the real commits; all four views work and
  respond to hash + postMessage.
- `npx tsc --noEmit` clean; `npx eslint app/concept/museum components/concept/museum` clean.
- `git status --porcelain` shows ONLY new files under the two allowed paths.
- Re-read the Prime Directive and audit your own output against it before finishing.
