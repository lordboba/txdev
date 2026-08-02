# Concept D — Bench (`/concept/bench`) — implementation brief

## Thesis

Product photography as interface. The centerpiece is a studio workbench carrying the
**actual shipped products** — device objects whose screens are textured with the real
screenshots in `public/projects/`. The spectacle IS the shipped work. If the screens
went blank, the page would be nothing; that is the point.

## Prime directive (anti-slop)

Every animated/3D element must be constructed from the real data in
`components/concept/conceptData.ts` or real assets in `public/`. **If an element would
survive swapping in someone else's resume unchanged, it fails.** No abstract geometry,
no particle fields, no gradient orbs, no floating shapes, no marquees, no numbered
`01/02` badges, no fake browser chrome.

## Study first (read these before writing code)

- `components/concept/conceptData.ts` — all content comes from here. Do not invent facts.
- `components/concept/conceptViewStore.ts` — `useConceptView()` / `setConceptView()`; hash + postMessage already handled.
- `components/concept/shared/runtime.ts` — `damp`, `useMounted`, `usePrefersReducedMotion`, `usePointerListener`. Use these.
- `components/concept/observatory/` — structural reference ONLY (store pattern, Canvas mounting, view wiring). Do NOT copy its visual language.
- `app/concept/observatory/page.tsx` — route pattern (metadata, `robots: { index: false }`).

## Files you may create (and nothing else)

```
app/concept/bench/page.tsx                    server component, metadata "Concept D · Bench — Tyler Xiao"
components/concept/bench/Bench.tsx            entry, named export `Bench`, 'use client'
components/concept/bench/*                    any supporting files you need (scene, store, module css)
```

**You may NOT edit any existing file.** Registry wiring is done by the orchestrator.
Do not touch `conceptData.ts`, `conceptRegistry.ts`, `package.json`, or anything outside
the two paths above. Do not install dependencies. Available: `three`,
`@react-three/fiber`, `@react-three/drei` (e.g. `useTexture`), React 19, Next 16.

## The object

A studio bench in one persistent `<Canvas>` (never remounted across views):

- **Phone devices** for the iOS products (`iCalarms`, `Charades 2026`): rounded-rect
  slab extrusions in phone proportions (~9:19.5), screen face textured with
  `/projects/icalarms.png` and `/projects/charades-2026.png`.
- **Mac windows** for the desktop/web products (`Personal Env`, `Med Negotiate`):
  thin window planes with a slight bezel, textured with their screenshots.
- Devices lie on a ground plane under soft studio light (ambient + one key light,
  contact shadow — drei `ContactShadows` or a baked radial gradient plane).
- Texture aspect: sample the PNG's real aspect ratio or letterbox correctly — do not
  stretch screenshots.

## Views (all four, driven by `useConceptView()`)

- **work** — the hero view. All four devices arranged on the bench like a product
  lineup being photographed. Hovering a device (or its DOM spec plate) lifts it a few
  cm and angles it toward camera, damped. Selecting focuses camera on it. DOM side:
  spec-sheet plates per project — title, role, description, `accent` rendered like a
  teardown spec label (e.g. `AlarmKit / EventKit`), and the live link.
- **profile** — devices recede/blur to the bench edges; center object is an ID badge /
  lanyard card carrying `public/pfp.JPG` and the `personalNotes` engraved as card
  fields. `companyRun` renders as a DOM spec table (company / period / detail,
  `tabular-nums`).
- **signals** — three **unfinished** devices for `experiments` A/B/C: wireframe or
  bare-aluminum blanks with no screen texture, each stamped with its status
  (`Shipping` / `Measuring` / `Collecting`). The contrast finished-vs-blank carries
  the meaning.
- **history** — the bench shows six generations of one artifact: six small plane
  "screens" in a row, one per `gitEras` entry, each filled with that era's palette
  (parse the palette words into representative colors) and its `visualLanguage` label
  etched beneath. Camera tracks along the row.

View changes are camera transits (damped), never crossfades or remounts.

## Look

- **Palette:** light studio — fog-grey ground `#dfe1e3` → `#b8bbbe`, ink `#141517`
  for type. **No accent color** — the screenshots are the only color on the page.
- **Type:** one clean grotesque (system stack fine: `Helvetica Neue`/`Inter`-style),
  spec-sheet conventions: small caps or letterspaced labels ONLY for field names,
  `tabular-nums` for every number, generous whitespace. No serif, no mono except
  measurements if needed.
- **Motion:** slow, weighted, product-video pacing. Use `damp` from shared runtime.

## Hard constraints

- ESLint forbids `useEffect`. Use `useSyncExternalStore` boundaries as in
  `shared/runtime.ts`; frame-rate state (camera, hover) lives in a module store, not
  React state.
- CSS Modules only for styling; no Tailwind classes inside the concept; nothing leaks.
- `usePrefersReducedMotion()`: when set, no parallax, transits become near-instant.
- Canvas mounts only after `useMounted()`; without WebGL the DOM chrome must stand
  alone as a legible page.
- Works standalone in an iframe at 1440×900 and 390×844 (the compare board renders it
  at true device size). On mobile: no pointer parallax, layout stacks.

## Definition of done

- All four views work and respond to hash changes and the board's postMessage.
- `npx tsc --noEmit` clean; `npx eslint app/concept/bench components/concept/bench` clean.
- `git status --porcelain` shows ONLY new files under the two allowed paths.
- Re-read the Prime Directive and audit your own output against it before finishing.
