# Concept E — Eval Run (`/concept/evalrun`) — implementation brief

## Thesis

The page presents the profile as a **benchmark harness executing**. Tyler's
professional identity is agent evaluation (Scale AI coding/reasoning evals, SafetyKit
trust & safety, the "agent reliability through explicit evaluation" experiment). So the
interface is an eval suite: test cases stream in, execute, and pass — and every test
name, assertion, and artifact is a **real fact from the data**. Profile-as-eval-report.

## Prime directive (anti-slop)

Every rendered element must derive from `components/concept/conceptData.ts`. **If an
element would survive swapping in someone else's resume unchanged, it fails.** No
invented test names, no lorem metrics, no decorative matrix-rain, no generic "terminal
cosplay" (no fake `$ ls`, no fake prompt art), no marquees, no `01/02` badges, no fake
browser chrome.

## Study first (read these before writing code)

- `components/concept/conceptData.ts` — the only source of content.
- `components/concept/conceptViewStore.ts` — `useConceptView()` / `setConceptView()`.
- `components/concept/shared/runtime.ts` — `useMounted`, `usePrefersReducedMotion`; follow its store patterns.
- `components/concept/observatory/` — structural reference ONLY (store + view wiring). Not visual reference.
- `app/concept/observatory/page.tsx` — route pattern.

## Files you may create (and nothing else)

```
app/concept/evalrun/page.tsx                  server component, metadata "Concept E · Eval Run — Tyler Xiao"
components/concept/evalrun/EvalRun.tsx        entry, named export `EvalRun`, 'use client'
components/concept/evalrun/*                  supporting files (run engine, store, module css)
```

**You may NOT edit any existing file.** No new dependencies. No WebGL needed for this
concept — its distinction is craft, timing, and information design, not 3D.

## The system

A run engine (module store, not React state) that "executes" a suite when a view is
entered:

- Each suite is compiled from data into ordered **cases**: name, assertion text,
  evidence, duration. Durations are **deterministic** — derived by hashing the case
  name (no `Math.random()`), so every replay is identical. Tabular-nums everywhere.
- Execution streams: a case appears as `RUNNING`, its timer counts, then it resolves
  `PASS` with an evidence line. Stagger so the whole suite settles in ~3–5s.
- A persistent header bar reads like a CI job: suite name, case count `n/m`, wall
  time accumulating, and the current view's id as the invocation target.
- Entering a view re-runs its suite. A "re-run" control replays it. Cases already
  resolved collapse to compact rows; the running case is prominent.

## Views as suites (all four, driven by `useConceptView()`)

- **profile** — `identity.suite`. Cases from `personalNotes` + basics, phrased as
  assertions: `expect(origin).toBe("San Diego")` → evidence "Raised in San Diego";
  UCLA CS, the running background, the four cities. `companyRun` renders as the
  suite's **environment/config block** (a fenced key-value panel: company, period,
  detail) — configuration, not test cases.
- **work** — `shipped.suite`, the hero view. Each `featuredProjects` entry is a case:
  it runs, passes, and emits its **artifact** — the real screenshot
  (`image` field) rendered as an output attachment with the `accent` string as the
  stack label and the live `link` as `artifact.url`. Screenshots render large and
  sharp; they are the payoff of each case.
- **signals** — `inflight.suite`. The three `experiments` are cases that do NOT all
  pass: map status → state. `Shipping` → PASS, `Measuring` → RUNNING (timer keeps
  counting forever), `Collecting` → PENDING/queued. An honest in-progress board.
- **history** — `regression.suite`. Six checkpoints from `gitEras`, ordered by date:
  each case is `era("Foundation") @ 96ccd76` with the real commit hash and date, its
  description as the assertion body, and a swatch row for its palette words. All
  pass; the suite reads as "no regressions across six redesigns."

## Look

- **NOT a terminal.** A CI dashboard crossed with a lab report. Structured rows,
  rules, and columns — not a scrollback buffer.
- **Palette:** near-black green-tinted ground `#0d120e`; pass `#8fd97a`; running
  amber `#e0b45c`; pending dim `#5a6157`; body text `#cfd6cc`. One palette, no
  gradients.
- **Type:** a mono for case ids, hashes, timers (`tabular-nums`); a plain sans for
  assertion prose and descriptions. The mix is the visual signature — set it
  carefully (mono small and dense, sans readable and unletterspaced).
- **Motion:** appearance/resolve transitions are fast and mechanical (≤150ms,
  `steps()` or sharp ease-out); timers tick; a thin progress rule advances per suite.
  Nothing floats, nothing drifts.

## Hard constraints

- ESLint forbids `useEffect`. The run engine is a module store driven by
  `requestAnimationFrame` or timers, subscribed via `useSyncExternalStore`
  (see `shared/runtime.ts` patterns). Ticking timers must not re-render whole trees —
  isolate timer text into small subscribed components.
- CSS Modules only; nothing leaks.
- `usePrefersReducedMotion()`: suites resolve instantly (all end-state, no streaming),
  timers show final values.
- Works standalone in an iframe at 1440×900 and 390×844; mobile stacks to a single
  column and stays legible.

## Definition of done

- All four suites run, replay deterministically, and respond to hash + postMessage.
- `npx tsc --noEmit` clean; `npx eslint app/concept/evalrun components/concept/evalrun` clean.
- `git status --porcelain` shows ONLY new files under the two allowed paths.
- Re-read the Prime Directive and audit your own output against it before finishing.
