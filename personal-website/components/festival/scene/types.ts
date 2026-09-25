/**
 * The Mid-Autumn layer's shared contract. Every festival module implements or
 * consumes these types and nothing else crosses module boundaries (see
 * docs/mid-autumn/CONTRACTS.md). Runtime-free except the small constant tables
 * at the bottom; `three` is referenced as types only, so `sim.ts` and the node
 * tests can import this file without loading it.
 *
 * Numbers come from the art-direction bible; the section is cited inline.
 */

import type {
  BufferGeometry,
  DataTexture,
  Object3D,
  Texture,
  WebGLRenderer,
} from 'three';

import type { FestivalRoute } from '../../../lib/festival.ts';
import type { AccentTints, Rgb01 } from '../palette.ts';

// ---------------------------------------------------------------------------
// Geometry primitives (CSS px, top-left origin, unless the name says world)
// ---------------------------------------------------------------------------

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
/** Axis-aligned rectangle in CSS px; `y` grows downward. */
export type Rect = { x: number; y: number; w: number; h: number };
export type Viewport = { w: number; h: number };
/** The subset of `DOMRect` the layout reader needs. */
export type RectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** World space (§7.3): origin at viewport centre, +y up, 100 px per unit at z 0. */
export type WorldPoint = { x: number; y: number; z: number };

// ---------------------------------------------------------------------------
// Lanterns (§3, §4.5, §5.1)
// ---------------------------------------------------------------------------

export type LanternId = 'A' | 'B' | 'C';

/** Where a cord hangs from (§2.2 "Cord"). Resolved to `cordAnchorY` by layout. */
export type CordAnchor =
  | { kind: 'viewport-top' }
  | { kind: 'fixed-y'; y: number }
  | { kind: 'nav-bottom'; fallbackY: number }
  | { kind: 'element-bottom'; selector: string; fallbackY: number };

/** A lantern as placed on the live viewport (the resolver's output). */
export interface LanternSpec {
  id: LanternId;
  /** Carries the 走马灯 strip (`aShadow = 1`); desktop only. */
  hero: boolean;
  /** Paper width in CSS px; paper height is `0.86 × body`. */
  body: number;
  /** Cord x and paper centre x, px. */
  x: number;
  /** Paper body rect at rest (θ = 0), px. */
  bodyRect: Rect;
  cord: CordAnchor;
  /** Resolved cord anchor y, px (viewport top, lintel, nav bottom …). */
  cordAnchorY: number;
  /** `bodyRect.y − cordAnchorY`, px. World length is `cordLengthPx / 100`. */
  cordLengthPx: number;
  /** Pendulum period T in seconds: hero 2.8, mid 2.4, small 2.1. */
  period: number;
  /** Carries the riddle slip (lantern B on `/blog`, `/past-experience`, `/schedule-a-call`). */
  slip: boolean;
  /** Slip strip rect at rest, px, for placement and exclusion checks. */
  slipRect: Rect | null;
  /**
   * The unfolded riddle card at rest, px: hangs 8 px under the strip's foot,
   * inside the gutter (never over the copy column, an H1 or the Calendly
   * iframe). `null` whenever `slipRect` is null.
   */
  cardRect: Rect | null;
  /** Index into `paperTints`; no two lanterns on a page share one. */
  tint: 0 | 1 | 2;
  /** Lower-in order (0 = hero, then by x). Stagger 120·i on mount, 90·i on route. */
  order: number;
  /** Lantern z in [−0.4, 0.2] world; pool at z − 0.2 (§7.3). */
  z: number;
}

/** Live pendulum state per lantern (owned by sim.ts). Angles in radians. */
export interface LanternState {
  id: LanternId;
  /** Swing about the cord anchor; +θ leans the body toward +x. */
  theta: number;
  thetaDot: number;
  /** Current drawn cord length, world units; `cordTarget` is where it is going. */
  cordLength: number;
  cordTarget: number;
  /** `uLit` 0..1 (candle out → lit). `litTarget` follows the choreography. */
  lit: number;
  litTarget: number;
  /**
   * Pool and halo strength 0..1 on their own §4.1/§4.3 timeline: catch + 150
   * ms over 500 (400 on a route enter) with the (0, 0, 0, 1) curve; → 0 with
   * the snuff (160 route, 200 theme). Multiplies the pool and halo alpha.
   */
  pool: number;
  /** Flicker `aCandle`: `1 + 0.06·(noise(7t) + 0.5·noise(13t))`, floor 0.94. */
  candle: number;
  /**
   * Tassel angle relative to the body, radians (`PENDULUM.tassel`: ω
   * 2π/(0.45·T), ζ 0.35, restoring toward plumb, driven by the collar's
   * tangential acceleration; clamped ±0.35 rad).
   */
  tasselTheta: number;
  tasselThetaDot: number;
  /** Cord-stretch bob from scroll wind (ω 2π/0.45 s, ζ 0.5), px, |bob| ≤ 8. */
  bob: number;
  bobDot: number;
  /** Exit lift, px upward (0 → 40 desktop, 24 mobile scroll-lift). */
  rise: number;
  /** Whole-lantern alpha (exit fade). */
  alpha: number;
  /** 走马灯 `uScroll` 0..1 along the 4096 px strip. */
  shadowScroll: number;
  /** Damping ratio in force: 0.12 idle, 0.9 during scripted lifts. */
  zeta: number;
  /** Pivot (cord anchor) in world units at `z`. */
  pivot: WorldPoint;
}

/** The poem column as a virtual pendulum (§4.4): L 3.0 u, ζ 0.2, 0.15× field. */
export interface PoemState {
  theta: number;
  thetaDot: number;
  /** `rotate(θ·0.5)` clamped to ±0.6°, in degrees, ready for CSS. */
  leanDeg: number;
}

// ---------------------------------------------------------------------------
// Falling things (§5.2)
// ---------------------------------------------------------------------------

export type FallSpecies = 'floret' | 'leaf' | 'ginkgo';
/** 0 near, 1 mid, 2 far (leaves and ginkgo only: a far floret is a dust speck). */
export type DepthBand = 0 | 1 | 2;
/** Atlas tile index: 0 floret, 1 leaf, 2 ginkgo, 3 the pre-blurred floret (painted, unused). */
export type AtlasCell = 0 | 1 | 2 | 3;

/** One instance; the `set once` fields are fixed at build, the rest per frame. */
export interface FallInstance {
  index: number;
  seed: number;
  species: FallSpecies;
  band: DepthBand;
  atlasCell: AtlasCell;
  /**
   * Screen size of the atlas tile at band scale 1.0, px (long axis). For
   * florets the tile is a three-floret fascicle, so one corolla is ≈ 0.36 of
   * this (6–10 px from the 16–26 px tile, §5.2).
   */
  sizePx: number;
  /** Descent time per viewport height, seconds. */
  descentS: number;
  flutterHz: number;
  flutterAmpPx: number;
  /** Spin about the long axis, rad/s. */
  spinRate: number;
  /** Full tumble (leaves and ginkgo only; the Froude split). */
  tumble: boolean;
  /** Respawn phase 0..1: `mod(ts·speed + seed·period, period)`. */
  phase: number;
  /** Warm/cool mix computed on the CPU at respawn (§2.3). */
  color: Rgb01;
  /** Live centre, absolute CSS px (viewport, top-left origin). */
  x: number;
  y: number;
  /** Live rotations, radians. */
  spin: number;
  tilt: number;
  /** Live alpha: band alpha × top/bottom 10% ramps × route cap × exit fades. */
  alpha: number;
  /** Which emitter rect the instance lives in (index into `florets.emitters`). */
  emitter: number;
}

// ---------------------------------------------------------------------------
// Wind (§4.4, §4.5): one module-scope field W(x, ts)
// ---------------------------------------------------------------------------

export interface GustSpec {
  /** Sim time (s) the front leaves `originX01`. */
  at: number;
  /** Dimensionless amplitude A ∈ [1.2, 2.2]; first gust 1.8. */
  amplitude: number;
  /** +1 left → right (80%), −1 right → left (20%). */
  direction: 1 | -1;
  /** Front speed in viewport widths per second (0.55). */
  speedVw: number;
  /** Launch x in viewport widths: −0.1 for L → R, 1.1 for R → L. */
  originX01: number;
}

/**
 * The wind field. One instance lives on `globalThis.__festivalWind` (§7.1) so
 * StrictMode, HMR and route changes never restart the weather.
 */
export interface WindApi {
  /** Simulation time in seconds; pauses while hidden; never reset by a route. */
  time(): number;
  /**
   * Advances the clock from a wall-clock timestamp (ms, `performance.now()`)
   * and returns the step in seconds, clamped to 0.033. Returns 0 while paused.
   */
  tick(nowMs: number): number;
  /** `W(x, ts)`, dimensionless: breeze + gust fronts + cursor + touch terms. */
  sample(x01: number, ts?: number): number;
  /** Vertical scroll wind `Fy = clamp(v, −3, 3) × 0.25`, decays `exp(−4 dt)`. */
  vertical(): number;
  /** Pointer velocity input, px/s, with the pointer position for falloff. */
  cursor(vxPxPerS: number, pointer: Vec2 | null, viewport: Viewport): void;
  /** `Fc × (1 − smoothstep(0, 0.35 vw, dist))` for an object at `point`. */
  cursorForceAt(point: Vec2, viewport: Viewport): number;
  /**
   * Mobile tap: local gust A 0.6, `(1 − cos)` over 1.2 s, radius 0.35 vw, at
   * most once per 3 s. Returns false when the tap was inside the interval
   * and ignored, so the integrator can skip the sim's impulse too.
   */
  touch(point: Vec2, viewport: Viewport): boolean;
  /** Scroll velocity in viewport heights per second (signed). */
  scroll(velocityVhPerS: number): void;
  /** Adds a gust; missing fields take the §4.5 defaults. */
  scheduleGust(gust: Partial<GustSpec> & Pick<GustSpec, 'at'>): void;
  /** Scheduled and in-flight gusts, for the gauntlet and `window.__festival`. */
  gusts(): readonly GustSpec[];
  pause(): void;
  resume(): void;
  paused(): boolean;
  /**
   * Jumps the clock forward by `seconds` of sim time without a step (the
   * evening that passed while no layer was mounted, §3.7): the cursor and
   * scroll terms are dropped and the gust schedule is maintained.
   */
  advance(seconds: number): void;
  /** Re-seeds the RNG and reschedules the gust train (first gust at 4.4 s). */
  reseed(seed: number): void;
  seed(): number;
  /** The seeded RNG, 0..1, for anyone who must stay deterministic. */
  random(): number;
}

// ---------------------------------------------------------------------------
// Sim (§4, §7.1): pure, seeded, no three
// ---------------------------------------------------------------------------

export type ThemeNight = 0 | 1;

export interface SimState {
  ts: number;
  lanterns: LanternState[];
  poem: PoemState;
  fall: FallInstance[];
  /** True once every cord is at length, every candle at 1 and text complete. */
  settled: boolean;
  /** Seconds the hero has kept |θ| < 1° continuously (translation gate). */
  heroStillFor: number;
}

export type Easing = 'enter' | 'exit' | 'std' | 'calm' | 'linear';

export interface SimOptions {
  seed: number;
  layout: RouteLayout;
  wind: WindApi;
  /** `1` on dark or `/`; `0` on light. Candle targets follow it. */
  night: ThemeNight;
  reducedMotion: boolean;
}

/**
 * The pure simulation. The integrator sequences the choreography (§4.1–4.3)
 * by issuing commands on sim time; the sim integrates them.
 */
export interface SimApi {
  readonly state: SimState;
  /** One step; `dt` in seconds, already clamped by the wind clock. */
  step(dt: number): void;
  /** Runs the floret loop and wind for `seconds` before frame 1 (6 s). */
  prewarm(seconds: number): void;
  /** Swaps the route table; florets re-clamp over 400 ms (damp λ 8). */
  setLayout(layout: RouteLayout, reason: 'mount' | 'route' | 'resize'): void;
  setNight(night: ThemeNight): void;
  /** Cord 0.05 → L over `durationS` with `easing`, ζ 0.9 while scripted. */
  lowerIn(id: LanternId, opts: { delayS: number; durationS: number }): void;
  /** Exit: θ frozen, rise `px` over `durationS`, alpha → 0. */
  raise(
    id: LanternId,
    opts: { delayS: number; durationS: number; px: number },
  ): void;
  /**
   * Candle keyframes (§4.1 catch or §4.2/4.3 snuff) toward `target`. A snuff
   * takes `easing` (default `'snuff'`, the §4.2 `(0.3, 0, 1, 1)`; the §4.3
   * morning passes `'exit'`). The pool/halo row follows on its own timeline
   * (`poolDelayS` / `poolDurationS`; defaults: catch +0.15 s over 0.5 s, snuff
   * 0 s over `durationS`). A later `light()` on the same lantern supersedes a
   * pending one: the stale job is skipped when it fires.
   */
  light(
    id: LanternId,
    opts: {
      delayS: number;
      durationS: number;
      target: number;
      easing?: Easing | 'snuff';
      poolDelayS?: number;
      poolDurationS?: number;
    },
  ): void;
  /**
   * Mobile tap (§4.4): a one-off angular kick `WIND.touch.kickRadPerS ×
   * falloff` to every hung lantern inside the 0.35 vw radius, in the gust's
   * direction, on top of the wind's 1.2 s gust. The gust alone moved the 44
   * px lantern half a pixel; the visitor who taps it must see it answer.
   */
  tap(point: Vec2): void;
  /** Schedules `fn` at sim time `ts` (pure: a sorted queue drained in `step`). */
  schedule(ts: number, fn: () => void): void;
  /**
   * Re-bases the settle gate: the route enter's floor/ceiling count from the
   * navigation, not from the layout swap 280 ms later (§4.2).
   */
  setSequenceStart(ts: number): void;
  /**
   * Moves one emitter rect in place (mobile `/`: the band tracks the studio
   * canvas per scrolled frame) without rebuilding the instances.
   */
  setEmitterRect(index: number, rect: Rect): void;
  /** Reduced motion: lanterns at θ 0.03, lit per night, florets from prewarm. */
  snapshotReduced(): SimState;
  /**
   * Reduced motion on mobile `/blog*`: the §3.3 scroll-lift as a snap. `true`
   * parks every lantern raised `px` with the candle out and alpha 0; `false`
   * restores rest length, alpha 1 and the night's candle state.
   */
  snapshotLift(lifted: boolean, px: number): SimState;
  /** Detaches nothing; the sim holds no listeners. Frees typed arrays. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Scene objects (§2.2, §5): raw three, ≤ 7 draw calls per frame
// ---------------------------------------------------------------------------

export interface FrameContext {
  ts: number;
  dt: number;
  viewport: Viewport;
  mobile: boolean;
  /** `/`: no halo, pool `light.pool.peakHome` (0.22 in paperHot), theme ignored. */
  home: boolean;
  /** `uNight` 0..1 (damped λ 8 across a theme switch). */
  night: number;
  /** The moon's own day/night blend: 0 → 1 over 900 ms std, 1 → 0 over 500 (§4.3). */
  moonNight: number;
  /** Pool / halo / seal colours from the hue gate, damped over 300 ms. */
  tints: AccentTints;
  /** Camera z from §7.3 for the live viewport height. */
  cameraZ: number;
  layout: RouteLayout;
  /**
   * Pointer parallax (§4.5), CSS px at parallax 1.0: the damped normalised
   * pointer × (8, 4) px, 0 at rest and in reduced motion. Depth bands take
   * `DEPTH_BANDS[].parallax` of it, the moon `light.moon.parallax` (0.85),
   * lanterns none.
   */
  parallax: Vec2;
}

/** lantern.ts: paper (instanced), hardware (instanced), cords, halos, pools. */
export interface LanternObjects {
  /** Added to the scene by the integrator; render order set inside. */
  readonly object: Object3D;
  /** (Re)builds instance buffers for ≤ 3 lanterns. Safe to call on route change. */
  build(specs: readonly LanternSpec[], frame: FrameContext): void;
  /** Writes matrices, `aCandle`, `aLit`, `aTint`, cord vertices and pool/halo alpha. */
  update(
    states: readonly LanternState[],
    specs: readonly LanternSpec[],
    frame: FrameContext,
  ): void;
  /** `null` → `aShadow = 0` everywhere (fonts not ready, or the V6 fallback). */
  setShadowStrip(texture: DataTexture | null): void;
  /** Bottom-collar world point per lantern, for the slip pin (`projectPx.ts`). */
  collarPoint(id: LanternId, out: WorldPoint): WorldPoint;
  dispose(): void;
}

/** lantern.ts: the 走马灯 strip (`SHADOW_STRIP`, 4096×128), built after `document.fonts.ready`. */
export type ShadowStripBuilder = (
  titles: readonly string[],
  fontFamily: string,
) => DataTexture;

/** fall.ts: one InstancedMesh, one atlas, one draw call. */
export interface FallObjects {
  readonly object: Object3D;
  readonly atlas: Texture;
  /** The unit plane; the moon quad borrows it so the page stays ≤ 6 geometries (§7.5). */
  readonly geometry: BufferGeometry;
  /** Allocates `count` instances (≤ 36 desktop, ≤ 12 mobile). */
  build(count: number, frame: FrameContext): void;
  /**
   * Composes matrices and `instanceColor` from the sim's instances;
   * `alphaScale` is the §4.1 mount fade (the sim's alpha stays untouched).
   */
  update(
    instances: readonly FallInstance[],
    frame: FrameContext,
    alphaScale?: number,
  ): void;
  dispose(): void;
}

export interface MoonState {
  /** Disc centre and diameter in px (glides between route anchors over 600 ms). */
  centre: Vec2;
  diameter: number;
  /** 0..1 disc alpha (fade 900 on mount, 280 on a route without a moon, 0.6 on scroll). */
  alpha: number;
  /** Halo peak alpha (0.18 dark, 0 light), breathing ±3% over 11 s. */
  haloAlpha: number;
  visible: boolean;
}

/** moon.ts: disc + halo in one quad at z −3. */
export interface MoonObjects {
  readonly object: Object3D;
  update(moon: MoonState, frame: FrameContext): void;
  dispose(): void;
}

/** How the integrator asks builders for their objects. */
export type LanternObjectsFactory = (renderer: WebGLRenderer) => LanternObjects;
export type FallObjectsFactory = (renderer: WebGLRenderer) => FallObjects;
/** `quad` is a borrowed unit plane (the fall system's); without it the moon makes its own. */
export type MoonObjectsFactory = (
  renderer: WebGLRenderer,
  moonTexture: Texture,
  quad?: BufferGeometry,
) => MoonObjects;

// ---------------------------------------------------------------------------
// Route layout (layout.ts output; see layout.ts for the tables)
// ---------------------------------------------------------------------------

export interface MoonAnchor {
  centre: Vec2;
  diameter: number;
}

export interface FloretLayout {
  count: number;
  /** Instances spawn and live inside these; outside → fade 300 ms, respawn. */
  emitters: Rect[];
  /** Never painted inside these (Calendly iframe, H1s, Bench plates …). */
  exclusions: Rect[];
  /** Alpha feather at the emitter clip, px (24 on `/schedule-a-call`). */
  featherPx: number;
  /** Route alpha cap (0.6 on `/`). */
  alphaMax: number;
  /** `/` only: alpha ramps to 0 between these y values (280 → 330). */
  alphaRampY: [number, number] | null;
  /** Mobile `/`: emitter tracks this element's rect per frame. */
  trackSelector: string | null;
}

export interface TextLockup {
  poem: Rect | null;
  colophon: Rect | null;
  colophonOrientation: 'vertical' | 'horizontal';
  translation: Rect | null;
  translationAlign: 'left' | 'right';
}

export interface ScrollLiftRule {
  liftAtScrollY: number;
  returnBelowScrollY: number;
  px: number;
  ms: number;
}

export interface MoonScrollDimRule {
  afterScrollY: number;
  to: number;
  ms: number;
}

export interface RouteLayout {
  route: FestivalRoute;
  viewport: Viewport;
  mobile: boolean;
  home: boolean;
  /** Canvas root z-index: `/` 2 (mobile 1), `/orbital` 2, NavBar routes 1. */
  zIndex: number;
  /**
   * HTML overlay root z-index: as `zIndex`, except `/orbital` (4) where the
   * canvas stays under `.orb-shell` (z 3) but the moon button and verse must
   * be hoverable above it.
   */
  overlayZIndex: number;
  lanterns: LanternSpec[];
  moon: MoonAnchor | null;
  florets: FloretLayout;
  text: TextLockup;
  /** Rects lantern bodies and slips must not intersect (V8). */
  exclusions: Rect[];
  /** Rects the moon, poem, colophon and translation must not intersect (V8). */
  textExclusions: Rect[];
  /** Live nav band bottom edge, px (0 when the route has no nav band). */
  navBottom: number;
  /**
   * The live nav band rect (null when the route has none): the moon keeps
   * its disc out of it while it glides in (§4.2), since the inset nav on
   * `/past-experience` paints over the layer and bit a corner off the disc.
   */
  navBand: Rect | null;
  /** Additive halo allowed (false on `/`). */
  halo: boolean;
  /** Pool peak alpha in the night state (`light.pool.peakDark` 0.14, or `peakHome` 0.22 on `/`). */
  poolPeak: number;
  /** `/` pins `uNight = 1`, `uLit = 1` and ignores `THEME_EVENT`. */
  ignoresTheme: boolean;
  scrollLift: ScrollLiftRule | null;
  moonScrollDim: MoonScrollDimRule | null;
  /** The riddle pool the slip draws from, or null when no slip. */
  riddlePool: 'project' | 'post' | null;
  /** Route seed for the riddle rotation (§6.A3). */
  routeSeed: number;
}

// ---------------------------------------------------------------------------
// Events, attributes, CSS custom properties, selectors
// ---------------------------------------------------------------------------

export const FESTIVAL_EVENTS = {
  /** `BenchHome.tsx` dispatches it at t = 0 of the rocket launch. */
  launch: 'bench:launch',
  /** `components/runtime/themePreferences.ts` `THEME_EVENT`. */
  theme: 'theme-preference-change',
} as const;

export const FESTIVAL_DATA_ATTRS = {
  /** `html[data-festival="mid-autumn"]` while the layer is mounted. */
  festival: 'data-festival',
  /** `'true'` once cords are at length, candles at 1 and text complete. */
  settled: 'data-festival-settled',
  /** Set on `<html>` by the journey overlay while open; the loop pauses. */
  journeyOpen: 'data-journey-open',
  theme: 'data-theme',
  colorTheme: 'data-color-theme',
} as const;

/** CSS custom properties written on the overlay root once per frame. */
export const FESTIVAL_CSS_VARS = {
  /**
   * Moon centre and diameter, px, for the sky tint and the moon button:
   * the anchor only, written by the glide and a resize. The pointer parallax
   * goes into `--moon-dx/-dy` (a transform on both), never here: the sky
   * gradient's `circle at` re-rasters the whole layer and the button's
   * `left/top` re-lay out on every value change.
   */
  moonX: '--moon-x',
  moonY: '--moon-y',
  moonD: '--moon-d',
  moonDx: '--moon-dx',
  moonDy: '--moon-dy',
  /** `uNight` 0..1; multiplies the sky-tint opacity. */
  night: '--festival-night',
  /** Slip pin: the bottom-collar point of lantern B and 0.8× its θ (deg). */
  slipX: '--slip-x',
  slipY: '--slip-y',
  slipTheta: '--slip-theta',
  /** Poem/colophon/translation rects from the layout, and the poem lean (deg). */
  poemX: '--poem-x',
  poemY: '--poem-y',
  poemTheta: '--poem-theta',
  colophonX: '--colophon-x',
  colophonY: '--colophon-y',
  translationX: '--translation-x',
  translationY: '--translation-y',
} as const;

/** DOM selectors the live-rect reader uses (stable, not CSS-module hashed). */
export const FESTIVAL_SELECTORS = {
  nav: 'header.sticky',
  toolsPill: '.orb-hero-tools',
  /** The `/orbital` dek under the H1: transparent text the fall must not cross. */
  orbitalDek: '.orb-title-copy',
  benchCanvas: 'main canvas',
  calendly: 'iframe',
} as const;

/** `window.__festival` under `?bench-debug=1` (§7.1). */
export interface FestivalDebugApi {
  wind(t?: number, x01?: number): number;
  rendererInfo(): unknown;
  theta(): number[];
  /** Tassel angle relative to each body, radians (M5's lag row). */
  tassel(): number[];
  frames(): number;
  layout(): RouteLayout;
  /** Sim seconds (the wind clock): the bible's timings are in this unit. */
  time(): number;
  state(): SimState | null;
  view(): unknown;
  /** The moon anchor plus its own day/night blend (`night`, 0..1) and the parallax offset (px). */
  moon(): MoonState & { night: number; parallax: Vec2 };
  /** §7.5 render CPU budget: ms per frame, exponential average and the max over the last 120. */
  frameMs(): { avg: number; max: number };
  gusts(): readonly GustSpec[];
  /** The 走马灯 strip's `userData` (font string, titles) once built, for T5. */
  strip(): Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Tuning tables (§4.5, §5.2) shared by sim, wind and fall
// ---------------------------------------------------------------------------

export const EASINGS: Record<
  Exclude<Easing, 'linear'>,
  readonly [number, number, number, number]
> = {
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
  std: [0.2, 0, 0, 1],
  calm: [0.37, 0, 0.63, 1],
};

export const PENDULUM = {
  /** `θ_eq = 0.04 rad · W`. */
  leanPerW: 0.04,
  zetaIdle: 0.12,
  zetaScripted: 0.9,
  idleClampRad: 0.22,
  /** Arrival kick: `θ̇ = 0.03·W` rad/s. */
  arrivalKick: 0.03,
  periods: { hero: 2.8, mid: 2.4, small: 2.1 },
  /**
   * The tassel is a second pendulum hung from the bottom collar: it restores
   * toward PLUMB (relative angle → −θ), not toward the body axis, and is
   * driven by the collar's tangential acceleration `(1 + R/l)·θ''` with R the
   * pivot-to-collar distance and l the tassel length (`lengthBodyWidths` of
   * the body width). Period √(24 px / 118 px) ≈ 0.45 of its body's T
   * (1.26 / 1.08 / 0.95 s), ζ 0.35, relative angle clamped to ±`clampRad`.
   * Restoring toward the axis gave a 0.4 px tip motion (16% of θ on a 24 px
   * tassel): welded to the lantern. Toward plumb the strands hang near
   * vertical while the body leans and whip at the reversals (M5).
   *
   * The drive is capped at `maxDrive` (the 176 px cord over an 18 px tassel
   * on lantern B gave 13.4, and a cursor push pinned the strands on the
   * clamp for 80 ms, a hard stop), and a cubic restoring term from
   * `softRad` outward makes the limit a weight, not a wall; `clampRad` stays
   * as the safety.
   */
  tassel: {
    periodFactor: 0.45,
    zeta: 0.35,
    lengthBodyWidths: 0.32,
    maxDrive: 6,
    softRad: 0.5,
    clampRad: 0.35,
  },
  bob: { periodS: 0.45, zeta: 0.5, maxPx: 8 },
  poem: {
    lengthU: 3.0,
    zeta: 0.2,
    drive: 0.15,
    renderScale: 0.5,
    clampDeg: 0.6,
  },
  slipThetaScale: 0.8,
  /** Translation gate: hero |θ| < 1° for T/2 (1.4 s); floor 2.4 s; ceiling 3.6 s. */
  settle: { thresholdDeg: 1, holdS: 1.4, floorS: 2.4, ceilingS: 3.6 },
  dtClampS: 0.033,
} as const;

export const WIND = {
  breeze: { octaves: 2, periodS: 9, amplitude: 0.5, spatialPhase: 0.7 },
  gust: {
    firstAtS: 4.4,
    firstAmplitude: 1.8,
    intervalS: [12, 18],
    amplitude: [1.2, 2.2],
    leftToRightProbability: 0.8,
    speedVw: 0.55,
    riseMs: 350,
    holdMs: 200,
    decayS: 1.4,
  },
  cursor: {
    velocityScale: 900,
    maxForce: 6,
    radiusVw: 0.35,
    decay: 3.5,
    floretShare: 0.25,
  },
  /** `kickRadPerS`: the sim's impulse per tap (peak ≈ 2.5° on the 2.1 s lantern). */
  touch: {
    amplitude: 0.6,
    durationS: 1.2,
    radiusVw: 0.35,
    minIntervalS: 3,
    kickRadPerS: 0.2,
  },
  scroll: { clamp: 3, scale: 0.25, decay: 4, floretLiftMaxPx: 12 },
  /** Floret lateral drift: `18·W + 5·curl2D` px/s. */
  floretDrift: { perW: 18, curl: 5 },
  revolvingDrift: { pxPerS: 10, waver: 0.15, waverHz: 0.4 },
} as const;

export const FALL_SPECIES: Record<
  FallSpecies,
  {
    sizePx: readonly [number, number];
    descentS: readonly [number, number];
    flutterPx: readonly [number, number];
    spin: readonly [number, number];
    tumble: number;
    atlasCell: AtlasCell;
  }
> = {
  floret: {
    // The three-floret fascicle tile; one corolla ≈ 0.36 × this = 6–10 px.
    sizePx: [16, 26],
    descentS: [11, 16],
    flutterPx: [12, 20],
    spin: [1, 2],
    tumble: 0,
    atlasCell: 0,
  },
  leaf: {
    sizePx: [22, 34],
    descentS: [8, 12],
    flutterPx: [18, 28],
    spin: [1, 3],
    tumble: 0.2,
    atlasCell: 1,
  },
  ginkgo: {
    sizePx: [26, 40],
    descentS: [9, 13],
    flutterPx: [20, 28],
    spin: [1, 3],
    tumble: 0.1,
    atlasCell: 2,
  },
};

/** Species mix on a 36-instance page: 22 florets, 8 leaves, 6 ginkgo (≤ 17%). */
export const FALL_SPECIES_MIX: Record<FallSpecies, number> = {
  floret: 22 / 36,
  leaf: 8 / 36,
  ginkgo: 6 / 36,
};

export const FALL_FLUTTER_HZ: readonly [number, number] = [0.6, 1.1];

export const DEPTH_BANDS: readonly {
  band: DepthBand;
  scale: number;
  alpha: number;
  parallax: number;
  z: number;
}[] = [
  { band: 0, scale: 1.0, alpha: 1.0, parallax: 1.0, z: 1.5 },
  { band: 1, scale: 0.7, alpha: 0.7, parallax: 0.6, z: 0 },
  { band: 2, scale: 0.45, alpha: 0.45, parallax: 0.3, z: -1.5 },
];

/** Atlas: 1024×512, four tiles in a row (§5.2). */
export const FALL_ATLAS = { width: 1024, height: 512, tiles: 4 } as const;

/**
 * 走马灯 strip (§5.1): 4096×128 (512 KB, inside the 1 MB budget). Cormorant
 * Garamond's cap height is 0.63 em, so 76 px caps are 48 px = 37.5% of the
 * strip, which the shader maps onto the paper height: 28 px caps on the 88 px
 * hero, 23 px on 72. Baseline 88 centres the cap band (y 40–88).
 */
export const SHADOW_STRIP = {
  width: 4096,
  height: 128,
  fontPx: 76,
  fontWeight: 600,
  trackingEm: 0.08,
  blurPx: 2,
  baselineY: 88,
  separator: ' · ',
} as const;

/** Mount and route timings (§4.1, §4.2), ms. */
export const CHOREOGRAPHY = {
  mount: {
    canvasFadeMs: 200,
    floretFadeMs: 1600,
    moonFadeMs: 900,
    moonHaloDelayMs: 150,
    moonHaloMs: 600,
    lanternStaggerMs: 120,
    lowerInMs: 1100,
    candleDelayMs: 150,
    candleMs: 700,
    poolDelayMs: 150,
    poolMs: 500,
    poemStartMs: 1400,
    poemGlyphStaggerMs: 90,
    poemGlyphMs: 420,
    colophonStartMs: 2000,
    colophonGlyphStaggerMs: 60,
    colophonGlyphMs: 300,
    slipStartMs: 1900,
    slipMs: 600,
    translationMs: 500,
    settledAfterTranslationMs: 500,
    fontsReadyTimeoutMs: 800,
    prewarmS: 6,
  },
  route: {
    slipExitMs: 160,
    textExitMs: 180,
    candleOutMs: 160,
    riseDelayMs: 40,
    riseMs: 240,
    risePx: 40,
    moonGlideMs: 600,
    moonFadeMs: 280,
    floretReclampMs: 400,
    anchorRereadDelayMs: 60,
    lowerInDelayMs: 300,
    lanternStaggerMs: 90,
    lowerInMs: 520,
    candleDelayMs: 100,
    candleMs: 420,
    poolDelayMs: 150,
    poolMs: 400,
    poemStartMs: 900,
    poemGlyphStaggerMs: 70,
    poemGlyphMs: 360,
    colophonStartMs: 1300,
    colophonGlyphStaggerMs: 50,
    colophonGlyphMs: 260,
    slipStartMs: 1100,
    slipMs: 500,
    translationMs: 400,
    translationCeilingMs: 2400,
  },
  theme: {
    nightDampLambda: 8,
    candleDelayMs: 120,
    candleStaggerMs: 90,
    candleMs: 700,
    moonMs: 900,
    textMs: 400,
    snuffMs: 260,
    poolOutMs: 200,
    moonOutMs: 500,
    tintDampMs: 300,
  },
  /** Candle catch keyframes: [t 0..1, value]. */
  candleCatch: [
    [0, 0],
    [120 / 700, 0.15],
    [180 / 700, 0.05],
    [320 / 700, 0.6],
    [380 / 700, 0.45],
    [1, 1],
  ] as readonly (readonly [number, number])[],
  mobileScrollLift: {
    liftAtScrollY: 120,
    returnBelowScrollY: 40,
    px: 24,
    ms: 260,
  },
  loop: { maxHz: 60, minFrameGapMs: 15 },
} as const;
