# Mid-Autumn layer: build contracts

One page for the three builders and the integrator. The art-direction bible (`ART_DIRECTION.md`) is the spec; this page is the seam between modules. Numbers live in code now: **when this page and the code disagree, the code wins; when the code and the bible disagree, fix the code.**

## 1. Ownership map (bible §7.1)

| Owner          | Files                                                                                                                                                                                                                                                                                                                                                        | Imports allowed                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **Foundation** | `lib/festival.ts`, `components/festival/palette.ts`, `components/festival/scene/types.ts`, `components/festival/scene/layout.ts` (+ their tests in `lib/*.test.mjs`)                                                                                                                                                                                         | `three` as `import type` only                                                    |
| **Builder A**  | assets + data: `lib/festivalRiddles.ts`, `lib/festivalRiddles.test.mjs`, `components/festival/fonts.ts`, `components/festival/fonts/NotoSerifSC-festival.woff2`, `components/festival/festival.css`, `components/festival/festival.module.css`, `public/festival/moon-nearside-512.png`, `scripts/build-festival-font.mjs`, `scripts/build-moon-texture.mjs` | the four foundation files, `content/projectData.ts`, `lib/blog.ts` types         |
| **Builder B**  | sim + wind: `components/festival/scene/sim.ts`, `components/festival/scene/wind.ts`, `components/festival/sim.test.mjs`                                                                                                                                                                                                                                      | the four foundation files only. **No `three`, no DOM** (node tests import these) |
| **Builder C**  | scene objects: `components/festival/scene/lantern.ts`, `components/festival/scene/fall.ts`, `components/festival/scene/moon.ts`, `components/festival/scene/projectPx.ts`                                                                                                                                                                                    | the four foundation files, `three`, `three/addons/utils/BufferGeometryUtils.js`  |
| **Integrator** | React: `FestivalMount.tsx`, `MidAutumnLayer.tsx`, `FestivalCanvas.tsx`, `FestivalType.tsx`, `RiddleSlip.tsx`, `PoemColumn.tsx`, `scripts/gauntlet-festival.mjs`, the +6 lines in `app/layout.tsx`, `BenchHome.tsx`, `JourneyOverlay.tsx`, `runtime.ts`                                                                                                       | everything                                                                       |

**The rule: no builder imports another builder's module.** Cross-module data travels only through the four foundation files (`lib/festival.ts`, `palette.ts`, `scene/types.ts`, `scene/layout.ts`). Builder B never sees a `THREE.Object3D`; builder C never calls the sim; builder A never reads sim state. The integrator wires them: `wind.tick()` → `sim.step()` → `lanterns.update()` / `fall.update()` / `moon.update()` → CSS vars for the HTML.

Each builder exports a factory whose shape is already declared in `types.ts`:

- B: `createWind(seed: number): WindApi` (module singleton on `globalThis.__festivalWind`, §7.1) and `createSim(options: SimOptions): SimApi`.
- C: `createLanternObjects: LanternObjectsFactory`, `buildShadowStrip: ShadowStripBuilder`, `createFallObjects: FallObjectsFactory`, `createMoonObjects: MoonObjectsFactory`, plus `projectPx.ts` helpers over `worldToPx`.
- A: `riddleFor(pool, dayOfYear, routeSeed, posts): Riddle`, `festivalFont` (`next/font/local` → `--font-cjk`), the CSS files that mirror `PALETTE_CSS_VARS` under `html[data-festival="mid-autumn"]`.

Relative imports carry the `.ts` extension (`from '../palette.ts'`, `from './types.ts'`) so `node --test` can load the files without a bundler; `tsconfig` has `allowImportingTsExtensions`.

## 2. Coordinate conventions

- **Tables** are CSS px at 1440×900 desktop / 390×844 mobile, top-left origin, `y` down (bible §3). `Rect = { x, y, w, h }`.
- **Scaling** (`routeLayout`): never proportional. Every placed element has a horizontal anchor; its offset from that edge is kept at any width. `left`/`right` = viewport edge (`/`, `/orbital`, mobile); `center` = viewport centre (the `/orbital` H1); `container-left`/`-right` = the copy column edge on NavBar routes (Tailwind `max-w-4xl/6xl/5xl` centred, content width `min(maxWidth, w − 64)`: 832 / 1088 / 960 px at 1440). Vertical offsets are kept from the top. After anchoring, each lantern, slip, text block and moon is clamped into the viewport (2 px margin) and **dropped** if it would still enter the copy column or an exclusion rect, or if its cord would pass within 30 px of the moon disc (§0.4: drop, never cheat). Verse only appears when the moon fits.
- **Live rects**: pass `readLiveRects()` as the fourth argument; the nav band (`header.sticky`), the `/orbital` tools pill (`.orb-hero-tools`), the Bench canvas (`main canvas`) and the Calendly `iframe` override their table fallbacks. Bodies under a nav band are pushed to ≥ 24 px below it (12 px on mobile `/blog`, per the §3.3 table).
- **World space** (§7.3): 1 world unit = 100 CSS px at z = 0, origin at the viewport centre, +y up, +z toward the camera. Camera z = `h / 100 / 2 / tan(15°)` (16.79 at 900 px). A point at depth z projects with scale `cameraZ / (cameraZ − z)`; use `pxToWorld(p, viewport, z)` / `worldToPx(p, viewport)` and never hand-roll it. Lanterns z ∈ [−0.4, 0.2], pools at lantern z − 0.2, florets z 1.5 / 0 / −1.5 by depth band, moon z −3.
- **Angles** are radians in the sim, `+θ` leans the body toward +x; CSS gets degrees (`PoemState.leanDeg`, `--slip-theta`).
- **Time**: `ts` is wind-clock seconds (module-scope, pauses when hidden, never reset by a route). `dt` ≤ 0.033 s. Choreography timings in `CHOREOGRAPHY` are ms; convert once.
- **Colours**: hex strings in `palette`; `hexToRgb01()` gives sRGB-encoded 0..1 for `THREE.Color.setRGB(r, g, b, THREE.SRGBColorSpace)`. Page-side tints come from `accentTints(liveAccentHex)` and nothing else.

## 3. Exported signatures (verbatim from the `.d.ts`; doc comments in the source)

### `lib/festival.ts`

```ts
export type FestivalScript = 'Hans' | 'Hant';
export type FestivalConfig = {
  enabled: boolean;
  script: FestivalScript;
  date: string;
  window: { start: string; end: string };
  revolvingOnHome: boolean;
};
export declare const festival: FestivalConfig; // { enabled: true, script: 'Hans', date: '2026-09-25', window: { start: '2026-09-21', end: '2026-10-04' }, revolvingOnHome: true }
export declare const FESTIVAL_ATTRIBUTE_VALUE = 'mid-autumn';
export declare const FESTIVAL_STORAGE_KEY = 'festival';
export declare const FESTIVAL_QUERY_KEY = 'festival';
export declare const FESTIVAL_SEED_QUERY_KEY = 'festival-seed';
export declare const FESTIVAL_ENV_KEY = 'NEXT_PUBLIC_FESTIVAL';
export declare const MOBILE_MAX_WIDTH = 700;
export declare const MOBILE_MEDIA_QUERY = '(max-width: 700px)';
export declare function isMobileWidth(viewportWidth: number): boolean;
export declare const FESTIVAL_ROUTES: readonly [
  '/',
  '/orbital',
  '/blog',
  '/blog/[slug]',
  '/past-experience',
  '/schedule-a-call',
];
export type FestivalRoute = (typeof FESTIVAL_ROUTES)[number];
export declare function festivalRoute(pathname: string): FestivalRoute | null;
export declare function isFestivalRoute(pathname: string): boolean;
export declare function isFestivalEnabledOnServer(
  env?: Record<string, string | undefined>,
  config?: FestivalConfig,
): boolean;
export declare function localDateKey(date: Date): string;
export declare function isWithinFestivalWindow(
  now: Date,
  window?: FestivalConfig['window'],
): boolean;
export declare function parseFestivalOverride(
  search: string | URLSearchParams | null | undefined,
): boolean | null;
export declare function parseFestivalSeed(
  search: string | URLSearchParams | null | undefined,
): number | null;
export declare function readStoredOverride(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): boolean | null;
export type FestivalGateInput = {
  search?: string | URLSearchParams | null;
  storedOverride?: boolean | null;
  now?: Date;
  config?: FestivalConfig;
};
export type FestivalGate = {
  active: boolean;
  reason: 'flag-off' | 'query' | 'storage' | 'window';
  persist: boolean | null;
  seed: number | null;
};
export declare function resolveFestivalGate({
  search,
  storedOverride,
  now,
  config,
}?: FestivalGateInput): FestivalGate;
export declare const COLOPHON_FALLBACK = '丙午年八月十五';
export declare const COLOPHON_LABEL = 'THE FIFTEENTH NIGHT';
export declare const COLOPHON_TITLE =
  'Mid-Autumn, the fifteenth night of the eighth month, year 丙午';
export declare function hanDay(day: number): string;
export declare function parseLocalDate(iso: string): Date;
export declare function formatChineseDate(
  date: Date,
  script?: FestivalScript,
): string;
export declare function colophonDate(config?: FestivalConfig): string;
```

### `components/festival/palette.ts`

```ts
export type Hex = `#${string}`;
export type Rgb01 = readonly [number, number, number];
export declare const palette: {
  paperUnlit: '#e9dcc4';
  paperEdge: '#ffc773';
  paperMid: '#ffb61e';
  paperHot: '#ffa631';
  paperCore: '#ffd58a';
  paperRim: { from: '#9c5333'; to: '#7a3d1a' };
  rib: '#5a3a22';
  cap: '#161823';
  capChamfer: '#60281e';
  brass: '#b08d57';
  cord: { dark: '#2a1f18'; light: '#4a3a2c' };
  tassel: { from: '#bf242a'; to: '#8f1c22' };
  knot: '#9d2933';
  moonBody: '#fffbf0';
  moonRim: '#d6ecf0';
  frost: '#e9f1f6';
  nightNearMoon: '#425066';
  floretGold: '#f0c239';
  floretIvory: '#fff6dc';
  floretOrange: '#ff8936';
  leafGreen: { top: '#789262'; underside: '#8fa37a' };
  ginkgo: { from: '#d3b17d'; to: '#9aa66f' };
  ink: { primary: '#2b241c'; secondary: '#3d4a54' };
  slipPaper: '#efe4cf';
  slipEdge: '#d9cbb0';
};
export type PaletteName = keyof typeof palette;
export declare const siteTokens: {
  background: { dark: '#12100d'; light: '#f5f1e9' };
  foreground: { dark: '#f4ecdf'; light: '#12100d' };
  accent: { dark: '#c89b52'; light: '#a57b37' };
  benchInk: '#141517';
  benchSet: '#c8c8c8';
};
export declare const paperTints: readonly [Hex, Hex, Hex]; // '#ffb61e' '#ffb020' '#ffbd2e'
export declare const floretSpeciesMix: readonly [
  { color: '#f0c239'; weight: 0.8 },
  { color: '#fff6dc'; weight: 0.15 },
  { color: '#ff8936'; weight: 0.05 },
];
export declare const light: {
  halo: { widthFactor: 2.8; falloffPow: 2.4; peakDark: 0.35; peakLight: 0 };
  pool: {
    widthFactor: 3.2;
    aspect: 1.35;
    centreDropBodyHeights: 0.4; // below the BOTTOM collar (lantern.ts adds the 0.5)
    falloffPow: 2;
    peakDark: 0.14;
    peakHome: 0.22;
    homeTint: '#ffa631';
    peakLight: 0;
    zOffset: -0.2;
    maxAlphaAtColumnEdge: 0.02;
  };
  moon: {
    limbPow: 0.35;
    halo: {
      diameterFactor: 2.2;
      falloffPow: 2.6;
      peakDark: 0.18;
      peakLight: 0;
    };
    haloBreathAmplitude: 0.03;
    haloBreathPeriodS: 11;
    lightDiscAlpha: 0.07;
    lightMariaAlpha: 0.03;
    scrollDimAfterPx: 400;
    scrollDimTo: 0.6;
    scrollDimMs: 400;
    z: -3;
    parallax: 0.85;
  };
  skyTint: { alpha: 0.12; radiusDiameters: 1.1 };
  paper: {
    throughPow: 1.35;
    candleBand: 0.62;
    candleY: 0.05;
    coreMix: 0.55;
    ribDarken: 0.45;
    ribInner: 0.012;
    ribOuter: 0.035;
    ribCount: 16;
    fibreStrength: 0.06;
    unlitRibDarken: 0.12;
    shadowDarken: 0.6;
    shadowViewPow: 0.6; // shadow × through^0.6 (softer than the paper's own through)
    shadowCircumferenceFraction: 0.15;
  };
  candle: { amplitude: 0.06; floor: 0.94; hz1: 7; hz2: 13 };
  floret: { coolMix: 0.45; coolSmoothstep: readonly [0.35, 0.9] };
  homeFloretAlphaMax: 0.6;
};
export declare const ACCENT_HUE_GATE: readonly [number, number]; // [55, 95]
export declare const POOL_ACCENT_MIX = 0.2;
export declare const HALO_ACCENT_MIX = 0.15;
export declare const PALETTE_CSS_VARS: {
  paperUnlit: '--festival-paper-unlit';
  paperMid: '--festival-paper-mid';
  paperCore: '--festival-paper-core';
  moonRim: '--festival-moon-rim';
  frost: '--festival-frost';
  nightNearMoon: '--festival-night-near-moon';
  tassel: '--festival-tassel';
  knot: '--festival-knot';
  ink: '--festival-ink';
  inkSecondary: '--festival-ink-secondary';
  slipPaper: '--festival-slip-paper';
  slipEdge: '--festival-slip-edge';
  poolTint: '--festival-pool-tint';
  haloTint: '--festival-halo-tint';
  underline: '--festival-underline';
};
export declare function hexToRgb255(
  hex: string,
): readonly [number, number, number];
export declare function hexToRgb01(hex: string): Rgb01;
export declare function rgb01ToHex(rgb: Rgb01): Hex;
export declare function mixHex(a: string, b: string, t: number): Hex; // per-channel sRGB mix, like GLSL mix on encoded values
export declare function relativeLuminance(hex: string): number;
export declare function contrastRatio(a: string, b: string): number;
export type Oklch = { l: number; c: number; h: number };
export declare function hexToOklch(hex: string): Oklch;
export declare function accentPassesHueGate(accentHex: string): boolean;
export type AccentTints = { pool: Hex; halo: Hex; passed: boolean };
export declare function coolTowardMoon(
  warm: Rgb01,
  dMoon: number | null,
  dNearestLantern: number,
): Rgb01;
export declare function accentTints(accentHex: string): AccentTints;
```

### `components/festival/scene/types.ts`

```ts
export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Viewport = { w: number; h: number };
export type RectLike = { left: number; top: number; right: number; bottom: number };
export type WorldPoint = { x: number; y: number; z: number };
export type LanternId = 'A' | 'B' | 'C';
export type CordAnchor = { kind: 'viewport-top' } | { kind: 'fixed-y'; y: number } | { kind: 'nav-bottom'; fallbackY: number } | { kind: 'element-bottom'; selector: string; fallbackY: number };
export interface LanternSpec { id: LanternId; hero: boolean; body: number; x: number; bodyRect: Rect; cord: CordAnchor; cordAnchorY: number; cordLengthPx: number; period: number; slip: boolean; slipRect: Rect | null; cardRect: Rect | null; tint: 0 | 1 | 2; order: number; z: number }
export interface LanternState { id: LanternId; theta: number; thetaDot: number; cordLength: number; cordTarget: number; lit: number; litTarget: number; pool: number; candle: number; tasselTheta: number; tasselThetaDot: number; bob: number; bobDot: number; rise: number; alpha: number; shadowScroll: number; zeta: number; pivot: WorldPoint }
export interface PoemState { theta: number; thetaDot: number; leanDeg: number }
export type FallSpecies = 'floret' | 'leaf' | 'ginkgo';
export type DepthBand = 0 | 1 | 2;
export type AtlasCell = 0 | 1 | 2 | 3;
export interface FallInstance { index: number; seed: number; species: FallSpecies; band: DepthBand; atlasCell: AtlasCell; sizePx: number; descentS: number; flutterHz: number; flutterAmpPx: number; spinRate: number; tumble: boolean; phase: number; color: Rgb01; x: number; y: number; spin: number; tilt: number; alpha: number; emitter: number }
export interface GustSpec { at: number; amplitude: number; direction: 1 | -1; speedVw: number; originX01: number }
export interface WindApi {
  time(): number;
  tick(nowMs: number): number;
  sample(x01: number, ts?: number): number;
  vertical(): number;
  cursor(vxPxPerS: number, pointer: Vec2 | null, viewport: Viewport): void;
  cursorForceAt(point: Vec2, viewport: Viewport): number;
  touch(point: Vec2, viewport: Viewport): boolean; // false when inside the 3 s interval (ignored)
  scroll(velocityVhPerS: number): void;
  scheduleGust(gust: Partial<GustSpec> & Pick<GustSpec, 'at'>): void;
  gusts(): readonly GustSpec[];
  pause(): void;
  resume(): void;
  paused(): boolean;
  advance(seconds: number): void; // the evening that passed while no layer was mounted (§3.7)
  reseed(seed: number): void;
  seed(): number;
  random(): number;
}
export type ThemeNight = 0 | 1;
export interface SimState { ts: number; lanterns: LanternState[]; poem: PoemState; fall: FallInstance[]; settled: boolean; heroStillFor: number }
export type Easing = 'enter' | 'exit' | 'std' | 'calm' | 'linear';
export interface SimOptions { seed: number; layout: RouteLayout; wind: WindApi; night: ThemeNight; reducedMotion: boolean }
export interface SimApi {
  readonly state: SimState;
  step(dt: number): void;
  prewarm(seconds: number): void;
  setLayout(layout: RouteLayout, reason: 'mount' | 'route' | 'resize'): void;
  setNight(night: ThemeNight): void;
  lowerIn(id: LanternId, opts: { delayS: number; durationS: number }): void;
  raise(id: LanternId, opts: { delayS: number; durationS: number; px: number }): void;
  light(id: LanternId, opts: { delayS: number; durationS: number; target: number; easing?: Easing | 'snuff'; poolDelayS?: number; poolDurationS?: number }): void;
  tap(point: Vec2): void; // mobile tap: θ̇ += WIND.touch.kickRadPerS × falloff × direction on every hung lantern in the radius; called only when wind.touch() returned true
  setSequenceStart(ts: number): void;
  setEmitterRect(index: number, rect: Rect): void;
  schedule(ts: number, fn: () => void): void;
  snapshotReduced(): SimState;
  snapshotLift(lifted: boolean, px: number): SimState; // reduced motion: the mobile scroll-lift as a snap
  dispose(): void;
}
export interface FrameContext { ts: number; dt: number; viewport: Viewport; mobile: boolean; home: boolean; night: number; moonNight: number; tints: AccentTints; cameraZ: number; layout: RouteLayout; parallax: Vec2 /* pointer parallax px at 1.0: bands take DEPTH_BANDS[].parallax, the moon 0.85, lanterns none */ }
export interface LanternObjects {
  readonly object: Object3D;
  build(specs: readonly LanternSpec[], frame: FrameContext): void;
  update(states: readonly LanternState[], specs: readonly LanternSpec[], frame: FrameContext): void;
  setShadowStrip(texture: DataTexture | null): void;
  collarPoint(id: LanternId, out: WorldPoint): WorldPoint;
  dispose(): void;
}
export type ShadowStripBuilder = (titles: readonly string[], fontFamily: string) => DataTexture;
export interface FallObjects { readonly object: Object3D; readonly atlas: Texture; readonly geometry: BufferGeometry; build(count: number, frame: FrameContext): void; update(instances: readonly FallInstance[], frame: FrameContext, alphaScale?: number): void; dispose(): void }
export interface MoonState { centre: Vec2; diameter: number; alpha: number; haloAlpha: number; visible: boolean }
export interface MoonObjects { readonly object: Object3D; update(moon: MoonState, frame: FrameContext): void; dispose(): void }
export type LanternObjectsFactory = (renderer: WebGLRenderer) => LanternObjects;
export type FallObjectsFactory = (renderer: WebGLRenderer) => FallObjects;
export type MoonObjectsFactory = (renderer: WebGLRenderer, moonTexture: Texture, quad?: BufferGeometry) => MoonObjects;
export interface MoonAnchor { centre: Vec2; diameter: number }
export interface FloretLayout { count: number; emitters: Rect[]; exclusions: Rect[]; featherPx: number; alphaMax: number; alphaRampY: [number, number] | null; trackSelector: string | null }
export interface TextLockup { poem: Rect | null; colophon: Rect | null; colophonOrientation: 'vertical' | 'horizontal'; translation: Rect | null; translationAlign: 'left' | 'right' }
export interface ScrollLiftRule { liftAtScrollY: number; returnBelowScrollY: number; px: number; ms: number }
export interface MoonScrollDimRule { afterScrollY: number; to: number; ms: number }
export interface RouteLayout { route: FestivalRoute; viewport: Viewport; mobile: boolean; home: boolean; zIndex: number; overlayZIndex: number; lanterns: LanternSpec[]; moon: MoonAnchor | null; florets: FloretLayout; text: TextLockup; exclusions: Rect[]; textExclusions: Rect[]; navBottom: number; navBand: Rect | null /* the live nav band; the moon keeps its disc 6 px out of it while gliding */; halo: boolean; poolPeak: number; ignoresTheme: boolean; scrollLift: ScrollLiftRule | null; moonScrollDim: MoonScrollDimRule | null; riddlePool: 'project' | 'post' | null; routeSeed: number }
export declare const FESTIVAL_EVENTS: { launch: 'bench:launch'; theme: 'theme-preference-change' };
export declare const FESTIVAL_DATA_ATTRS: { festival: 'data-festival'; settled: 'data-festival-settled'; journeyOpen: 'data-journey-open'; theme: 'data-theme'; colorTheme: 'data-color-theme' };
export declare const FESTIVAL_CSS_VARS: { moonX: '--moon-x'; moonY: '--moon-y'; moonD: '--moon-d'; night: '--festival-night'; slipX: '--slip-x'; slipY: '--slip-y'; slipTheta: '--slip-theta'; poemX: '--poem-x'; poemY: '--poem-y'; poemTheta: '--poem-theta'; colophonX: '--colophon-x'; colophonY: '--colophon-y'; translationX: '--translation-x'; translationY: '--translation-y' };
export declare const FESTIVAL_SELECTORS: { nav: 'header.sticky'; toolsPill: '.orb-hero-tools'; orbShell: '.orb-shell'; benchCanvas: 'main canvas'; homeThemeDock: '.home-theme-dock'; calendly: 'iframe' };
export interface FestivalDebugApi { wind(t?: number, x01?: number): number; rendererInfo(): unknown; theta(): number[]; tassel(): number[]; frames(): number; layout(): RouteLayout; time(): number; state(): SimState | null; view(): unknown; moon(): MoonState & { night: number; parallax: Vec2 }; frameMs(): { avg: number; max: number }; gusts(): readonly GustSpec[]; strip(): Record<string, unknown> | null }
// Tuning tables (values in the source, all from bible §4.1–4.5, §5.1–5.2):
export declare const EASINGS: Record<Exclude<Easing, 'linear'>, readonly [number, number, number, number]>;
export declare const PENDULUM: { leanPerW: 0.04; zetaIdle: 0.12; zetaScripted: 0.9; idleClampRad: 0.22; arrivalKick: 0.03; periods: { hero: 2.8; mid: 2.4; small: 2.1 }; tassel: { periodFactor: 0.45; zeta: 0.35; lengthBodyWidths: 0.32; maxDrive: 6; softRad: 0.5; clampRad: 0.35 } /* a pendulum from the collar, restoring toward plumb, driven min(1 + R/l, maxDrive)·θ'', cubic soft limit from softRad, clampRad a safety */; bob: { periodS: 0.45; zeta: 0.5; maxPx: 8 }; poem: { lengthU: 3; zeta: 0.2; drive: 0.15; renderScale: 0.5; clampDeg: 0.6 }; slipThetaScale: 0.8; settle: { thresholdDeg: 1; holdS: 1.4; floorS: 2.4; ceilingS: 3.6 }; dtClampS: 0.033 };
export declare const WIND: { breeze: { octaves: 2; periodS: 9; amplitude: 0.5; spatialPhase: 0.7 }; gust: { firstAtS: 4.4; firstAmplitude: 1.8; intervalS: [12, 18]; amplitude: [1.2, 2.2]; leftToRightProbability: 0.8; speedVw: 0.55; riseMs: 350; holdMs: 200; decayS: 1.4 }; cursor: { velocityScale: 900; maxForce: 6; radiusVw: 0.35; decay: 3.5; floretShare: 0.25 }; touch: { amplitude: 0.6; durationS: 1.2; radiusVw: 0.35; minIntervalS: 3; kickRadPerS: 0.2 }; scroll: { clamp: 3; scale: 0.25; decay: 4; floretLiftMaxPx: 12 }; floretDrift: { perW: 18; curl: 5 }; revolvingDrift: { pxPerS: 10; waver: 0.15; waverHz: 0.4 } };
export declare const FALL_SPECIES: Record<FallSpecies, { sizePx: [number, number]; descentS: [number, number]; flutterPx: [number, number]; spin: [number, number]; tumble: number; atlasCell: AtlasCell }>;
export declare const FALL_SPECIES_MIX: Record<FallSpecies, number>; // 22/36, 8/36, 6/36
export declare const FALL_FLUTTER_HZ: readonly [number, number]; // [0.6, 1.1]
export declare const DEPTH_BANDS: readonly { band: DepthBand; scale: number; alpha: number; parallax: number; z: number }[]; // 1.0/0.7/0.45, z 1.5/0/−1.5
export declare const FALL_ATLAS: { width: 1024; height: 512; tiles: 4 };
export declare const SHADOW_STRIP: { width: 4096; height: 128; fontPx: 76; fontWeight: 600; trackingEm: 0.08; blurPx: 2; baselineY: 88; separator: ' · ' };
export declare const CHOREOGRAPHY: { mount: {…}; route: {…}; theme: {…}; candleCatch: readonly (readonly [number, number])[]; mobileScrollLift: { liftAtScrollY: 120; returnBelowScrollY: 40; px: 24; ms: 260 }; loop: { maxHz: 60; minFrameGapMs: 15 } };
```

### `components/festival/scene/layout.ts`

```ts
export declare const DESKTOP_BASE: Viewport; // 1440×900
export declare const MOBILE_BASE: Viewport; // 390×844
export declare const PAPER_ASPECT = 0.86;
export declare const PX_PER_WORLD_UNIT = 100;
export declare const CAMERA_FOV_DEG = 30;
export declare const NAV_CLEARANCE_PX = 24;
export declare const EDGE_MARGIN_PX = 2;
export declare const EXCLUSION_CLEARANCE_PX = 0;
export declare const TASSEL_DROP_FACTOR = 0.4;
export declare const SLIP_GAP_PX = 14;
export declare const SLIP_SIZE: { w: 38; h: 152 };
export type HAnchor =
  | 'left'
  | 'right'
  | 'center'
  | 'container-left'
  | 'container-right';
export type Placed<T> = T & { anchor: HAnchor };
export type LanternEntry = Placed<{
  id: LanternId;
  hero: boolean;
  body: number;
  x: number;
  bodyTop: number;
  cord: CordAnchor;
  period: number;
  slip: boolean;
  tint: 0 | 1 | 2;
}>;
export type RectEntry =
  | { kind: 'rect'; rect: Rect; anchor: HAnchor; stretch?: 'right' | 'left' }
  | { kind: 'viewport'; top?: number; bottom?: number }
  | { kind: 'container'; top?: number; bottom?: number }
  | {
      kind: 'gutter';
      side: 'left' | 'right';
      clearance: number;
      top?: number;
      bottom?: number;
    }
  | { kind: 'nav-band'; pad: number; fallback: Rect; anchor: HAnchor }
  | { kind: 'element'; selector: string; fallback: Rect; anchor: HAnchor };
export type TextEntry = Placed<{ rect: Rect }>;
export interface RouteTable {
  zIndex: number;
  lanterns: LanternEntry[];
  moon: Placed<MoonAnchor> | null;
  florets: {
    count: number;
    emitters: RectEntry[];
    exclusions: RectEntry[];
    featherPx: number;
    alphaMax: number;
    alphaRampY: [number, number] | null;
    trackSelector: string | null;
  };
  text: {
    poem: TextEntry | null;
    colophon: TextEntry | null;
    colophonOrientation: 'vertical' | 'horizontal';
    translation: TextEntry | null;
    translationAlign: 'left' | 'right';
  };
  exclusions: RectEntry[];
  textExclusions: RectEntry[];
  navBand: RectEntry | null;
  scrollLift: boolean;
  moonScrollDim: boolean;
}
export declare function routeTable(
  route: FestivalRoute,
  mobile: boolean,
): RouteTable;
export interface LiveRects {
  nav?: RectLike | null;
  elements?: Record<string, RectLike | null | undefined>;
}
export declare function fromRectLike(r: RectLike): Rect;
export declare function readLiveRects(root?: Document): LiveRects;
export declare function rectsIntersect(
  a: Rect,
  b: Rect,
  clearance?: number,
): boolean;
export declare function paperHeight(body: number): number;
export declare function cordClearsMoon(
  spec: LanternSpec,
  moon: MoonAnchor | null,
): boolean;
export declare function routeLayout(
  pathname: string,
  viewport: Viewport,
  mobile?: boolean,
  live?: LiveRects,
): RouteLayout | null;
export declare function cameraZ(viewportHeight: number): number;
export declare function worldPerPx(z: number, viewportHeight: number): number;
export declare function pxToWorld(
  p: Vec2,
  viewport: Viewport,
  z?: number,
  out?: WorldPoint,
): WorldPoint;
export declare function worldToPx(
  p: WorldPoint,
  viewport: Viewport,
  out?: Vec2,
): Vec2;
export declare function pxLengthToWorld(
  px: number,
  z: number,
  viewport: Viewport,
): number;
export declare function pendulumGravity(
  cordLengthWorld: number,
  periodS: number,
): number;
```

## 4. What the resolver produces at 1440×900 (pinned by `lib/festivalLayout.test.mjs`)

| Route              | Lanterns (id body @x, body rect, T)                                                                                             | Moon (centre, d) | Poem / colophon / translation                                         | Florets                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------- | ------------------------------------- |
| `/`                | A\* 72 @1300 x1264–1336 y120–182 2.8 · B 44 @1400 x1378–1422 y104–142 2.1; cords from y64                                       | none             | colophon horizontal x1215–1420 y252–264                               | 24 in x480–1440 y64–330, α ≤ .6       |
| `/orbital`         | C\* 64 @1330 x1298–1362 y120–175 2.8 (cord from the tools pill, 66) · A 56 @300 x272–328 y66–114 2.4                            | (160,100) 120    | x128–150 y176–302 / x106–118 y176–272 / x128–358 y314–330 left        | 30 full viewport                      |
| `/blog`            | A\* 88 @96 x52–140 y118–194 2.8 · B 56 @214 x186–242 y176–224 2.4 + slip x195–233 y238–390 · C 56 @1385 x1357–1413 y196–244 2.1 | (1268,185) 150   | x1178–1200 y276–402 / x1160–1172 y276–372 / x1190–1420 y412–429 right | 36: gutters ≥ y75 + band y75–150      |
| `/blog/[slug]`     | as `/blog`, no slip; moon dims to 0.6 past scrollY 400                                                                          | (1268,185) 150   | as `/blog`                                                            | 36                                    |
| `/past-experience` | A\* 72 @64 x28–100 y112–174 2.8 · B 52 @150 x124–176 y210–255 2.4 + slip x131–169 y269–421                                      | (1355,155) 130   | x1272–1294 y240–366 / x1254–1266 y240–336 / x1190–1420 y378–395       | 30: gutters x<176, x>1264             |
| `/schedule-a-call` | A\* 88 @92 x48–136 y112–188 2.8 · B 56 @196 x168–224 y196–244 2.4 + slip x177–215 y258–410 · C 52 @1396 x1370–1422 y240–285 2.1 | (1300,155) 130   | x1228–1250 y240–366 / x1210–1222 y240–336 / x1190–1420 y378–395       | 30: gutters x<232, x>1208, feather 24 |
| mobile `/blog*`    | A 44 @335 x313–357 y74–112 2.1, cord from the nav bottom (62); scroll-lift 120 / 40, 24 px, 260 ms                              | none             | none                                                                  | 6 in x200–374 y62–140, florets only   |
| mobile `/`         | none                                                                                                                            | none             | none                                                                  | 10 tracking `main canvas`             |
| mobile others      | none (`/orbital`: 12 florets full viewport; `/past-experience`, `/schedule-a-call`: nothing)                                    |                  |                                                                       |                                       |

\* = hero (走马灯). `order` is hero first, then by x; `z` is 0.2 for the hero, `−0.1·order` otherwise; `tint` is 0/1/2 in table order.

## 5. Interpretations the bible left open (flag if you disagree)

1. Periods not stated per lantern are assigned by role: hero 2.8, second 2.4, third 2.1 (`/orbital` A = 2.4; `/past-experience` B = 2.4; `/schedule-a-call` B = 2.4, C = 2.1). M4 needs no two within 8%.
2. Paper height is rounded to whole px (`paperHeight()`), as the bible's tables are; `/past-experience` B's slip therefore starts at y269, not 268.
3. Mobile `/blog` florets are confined to the free block x200–374 y62–140 (the bible gives only the count); V10 forbids painting under copy on a phone. They are six and florets only (`buildSpeciesTable(count, mobile)`), kept 8 px off the lantern.
4. `routeLayout` appends every lantern body (+6 px, +8 on mobile) and slip strip (+6) to `florets.exclusions` after the moon and text rects, so `fieldAlpha()` fades the fall off the paper; `/orbital` adds the H1 and the dek (`.orb-title-copy`), `/` the placard rail.
5. `mixHex` is a per-channel mix of the sRGB-encoded values. If builder C mixes in linear space inside a shader, the pool/halo tint must still be computed by `accentTints()` on the CPU and passed as a uniform so the V7 pixel assertion has one source of truth.
6. `LanternSpec.cordLengthPx` measures to the top of the paper body; the hook ring and top collar sit inside that length (builder C draws the cord to the ring).
7. `WindApi.tick()` owns the 33 ms clamp and returns 0 while paused; `SimApi.step(dt)` trusts it. The integrator calls `tick` once per rAF and never on pointer events.
