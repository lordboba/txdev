/**
 * The pure Mid-Autumn simulation (bible §4.1–4.6, §7.1). No three, no DOM.
 *
 * `createSim(options)` owns, per frame:
 *
 * - one damped pendulum per lantern, `θ'' = −(g'/L)(sin θ − 0.04·W·cos θ) − 2ζωθ'`
 *   with `g' = 4π²L/T²` (so ω = 2π/T whatever the drawn cord length), ζ 0.12
 *   idle and 0.9 while a lower-in or raise is scripted, idle clamp ±0.22 rad;
 * - the tassel as a second pendulum (`PENDULUM.tassel`: ω 2π/(0.45·T),
 *   ζ 0.35) restoring toward plumb and driven by the collar's tangential
 *   acceleration, and the cord-stretch bob (ω 2π/0.45, ζ 0.5, |bob| ≤ 8 px)
 *   driven by the scroll wind;
 * - the candle flicker, the 走马灯 strip scroll, the candle-catch keyframes
 *   and the pool/halo row on its own catch + 150 ms timeline;
 * - the poem column as a virtual pendulum (L 3 u, ζ 0.2, 0.15× the field
 *   plus the cursor term at the column);
 * - the floret loop: seeded species / band / emitter, `mod(ts/period + phase)`
 *   descent, flutter, spin, lateral drift `18·W + 5·curl2D` px/s, scroll lift,
 *   pop-free respawn, depth-band alpha, route continuity (§0.9 / §4.2: the
 *   pool is kept across a route change, an instance whose emitter survives
 *   slides into it with damp λ 8, one whose emitter is gone fades 300 ms and
 *   respawns, a surplus instance fades and is dropped, a new one fades in);
 * - settle detection for the translation gate: hero |θ| < 1° for T/2, floor
 *   2.4 s, ceiling 3.6 s after the mount sequence started (1.7 / 2.4 s on a
 *   route enter).
 *
 * The integrator sequences the choreography by calling `lowerIn`, `raise`,
 * `light` and `schedule` on sim time; the sim integrates. `step(dt)` trusts the
 * wind clock's 33 ms clamp (CONTRACTS §5.6) and sub-steps at ≤ 1/120 s.
 */

import {
  CHOREOGRAPHY,
  DEPTH_BANDS,
  EASINGS,
  FALL_FLUTTER_HZ,
  FALL_SPECIES,
  FALL_SPECIES_MIX,
  PENDULUM,
  WIND,
} from './types.ts';
import type {
  DepthBand,
  Easing,
  FallInstance,
  FallSpecies,
  LanternId,
  LanternSpec,
  LanternState,
  LightOptions,
  PoemState,
  Rect,
  RouteLayout,
  SimApi,
  SimOptions,
  SimState,
  ThemeNight,
  Vec2,
  Viewport,
  WindApi,
} from './types.ts';
import {
  PAPER_ASPECT,
  pendulumGravity,
  pxLengthToWorld,
  pxToWorld,
} from './layout.ts';
import {
  coolTowardMoon,
  floretSpeciesMix,
  hexToRgb01,
  light as lightRules,
  palette,
} from '../palette.ts';
import type { Rgb01 } from '../palette.ts';
import {
  clamp,
  cubicBezier,
  curl2,
  hash01,
  lerp,
  mulberry32,
  smoothstep,
  valueNoise1,
} from './noise.ts';
import type { NoiseSample } from './noise.ts';

// ---------------------------------------------------------------------------
// Constants derived from the tables
// ---------------------------------------------------------------------------

/** Translation gate per sequence (§4.1 mount, §4.2 route enter), seconds. */
export const SETTLE_GATES = {
  mount: {
    floorS: PENDULUM.settle.floorS,
    ceilingS: PENDULUM.settle.ceilingS,
  },
  /** Poem complete (900 + 70·4 + 360 = 1540 ms) + 160 ms; ceiling from §4.2. */
  route: {
    floorS:
      (CHOREOGRAPHY.route.poemStartMs +
        CHOREOGRAPHY.route.poemGlyphStaggerMs * 4 +
        CHOREOGRAPHY.route.poemGlyphMs +
        160) /
      1000,
    ceilingS: CHOREOGRAPHY.route.translationCeilingMs / 1000,
  },
} as const;

/** Cord length while a lantern waits above the eaves, world units (§4.1). */
export const CORD_RAISED_WORLD = 0.05;
/** Sub-step ceiling for the integrators, seconds. */
export const SUBSTEP_S = 1 / 120;
/** Where the reduced-motion snapshot parks the 走马灯 (a title on the lit front). */
export const REDUCED_SHADOW_SCROLL = 0.12;
/** Instances outside their emitter fade over this long, then respawn (§4.2). */
const OUTSIDE_FADE_S = 0.3;
/** Route re-clamp damping λ (§4.2 "damp λ 8"). */
const RECLAMP_LAMBDA = 8;
/**
 * On a route change an instance slides into its emitter's new rect when the
 * nearest inside x is within this reach; farther than that the emitter has
 * effectively gone (a `/blog` top-band floret over the copy column) and it
 * fades and respawns instead of crossing the page.
 */
const RECLAMP_REACH_PX = 160;
/** Instances born on a route change (the count grew) fade in over this long. */
const BIRTH_FADE_S = 0.4;
/** Curl-noise field scale (px per noise unit) and its drift in time (px/s). */
const CURL_SCALE_PX = 160;
const CURL_DRIFT_PX_PER_S = 24;
/** Poem pendulum gravity in world units/s² (the column is virtual). */
const POEM_GRAVITY = 9.81;

const SHADOW_STRIP_PX = 4096;
const DEG = 180 / Math.PI;
/** Pool/halo catch defaults (§4.1): catch + 150 ms over 500 ms. */
const POOL_DELAY_S = CHOREOGRAPHY.mount.poolDelayMs / 1000;
const POOL_MS_S = CHOREOGRAPHY.mount.poolMs / 1000;

/**
 * `light()` curves: the four shared easings, the §4.2 candle-out
 * `(0.3, 0, 1, 1)` and the pool/halo catch `(0, 0, 0, 1)`.
 */
export type LightEasing = Easing | 'snuff' | 'pool';

const ease: Record<LightEasing, (t: number) => number> = {
  enter: cubicBezier(...EASINGS.enter),
  exit: cubicBezier(...EASINGS.exit),
  std: cubicBezier(...EASINGS.std),
  calm: cubicBezier(...EASINGS.calm),
  linear: (t) => clamp(t, 0, 1),
  snuff: cubicBezier(0.3, 0, 1, 1),
  pool: cubicBezier(0, 0, 0, 1),
};

/** Candle-catch keyframes, piecewise linear on normalised time. */
function candleCatch(t: number): number {
  const keys = CHOREOGRAPHY.candleCatch;

  if (t <= 0) return keys[0][1];
  for (let i = 1; i < keys.length; i += 1) {
    const [t1, v1] = keys[i];

    if (t <= t1) {
      const [t0, v0] = keys[i - 1];

      return lerp(v0, v1, (t - t0) / (t1 - t0));
    }
  }

  return keys[keys.length - 1][1];
}

function mixRgb(a: Rgb01, b: Rgb01, t: number): Rgb01 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// ---------------------------------------------------------------------------
// Internal per-object bookkeeping (not part of the published state)
// ---------------------------------------------------------------------------

type CordScript = {
  kind: 'lower' | 'raise';
  start: number;
  durationS: number;
  from: number;
  to: number;
};

type LightScript = {
  start: number;
  durationS: number;
  from: number;
  to: number;
  easing: LightEasing;
};

type LanternInternal = {
  spec: LanternSpec;
  state: LanternState;
  lengthWorld: number;
  omega: number;
  omega2: number;
  /** `1 + R/l`: the collar's tangential acceleration per unit θ'', over the tassel length. */
  tasselDrive: number;
  centrePx: Vec2;
  x01: number;
  noiseSeed: number;
  cord: CordScript | null;
  lightScript: LightScript | null;
  poolScript: LightScript | null;
  /** θ frozen (a raise in flight or finished). */
  frozen: boolean;
  /** Pending lower-in / raise / light commands not yet started. */
  pending: number;
  bodyAccel: number;
};

type FallInternal = {
  inst: FallInstance;
  baseX: number;
  driftX: number;
  prevP: number;
  cycle: number;
  outsideFor: number;
  live: Rect;
  target: Rect;
  /** Route change: slide `baseX` into the emitter's new rect (damp λ 8). */
  reclamp: boolean;
  /** Route change: the emitter is gone; fade 300 ms, then respawn at the top. */
  exiting: boolean;
  /** Route change: beyond the new count; fade 300 ms, then drop. */
  surplus: boolean;
  /** Sim time of birth, for the route-change fade-in (−∞ at mount). */
  bornTs: number;
};

type Scheduled = { ts: number; fn: () => void; order: number };

const LEAF_TOP = hexToRgb01(palette.leafGreen.top);
const GINKGO_FROM = hexToRgb01(palette.ginkgo.from);
const GINKGO_TO = hexToRgb01(palette.ginkgo.to);
const FLORET_COLOURS = floretSpeciesMix.map((s) => ({
  color: hexToRgb01(s.color),
  weight: s.weight,
}));

// ---------------------------------------------------------------------------
// The sim
// ---------------------------------------------------------------------------

export function createSim(options: SimOptions): SimApi {
  const wind: WindApi = options.wind;
  const seed = options.seed;

  let layout: RouteLayout = options.layout;
  let viewport: Viewport = layout.viewport;
  let night: ThemeNight = options.night;
  let sequenceStart = wind.time();
  let gate: (typeof SETTLE_GATES)[keyof typeof SETTLE_GATES] =
    SETTLE_GATES.mount;
  let settledLatch = false;

  let moonPx: Vec2 | null = null;
  let lanternsPx: Vec2[] = [];
  let poemPx: Vec2 | null = null;
  let hero: LanternInternal | null = null;
  /** Species per index for the current count (exact 22/8/6 split at 36). */
  let speciesTable: FallSpecies[] = [];
  let speciesMobile = false;

  const lanterns: LanternInternal[] = [];
  const fall: FallInternal[] = [];
  const queue: Scheduled[] = [];
  let queueOrder = 0;

  const scratch: NoiseSample = { value: 0, dx: 0, dy: 0 };
  const curlOut = { x: 0, y: 0 };
  /** Scratch point for the per-object cursor force (no per-frame allocation). */
  const point: Vec2 = { x: 0, y: 0 };

  const state: SimState = {
    ts: wind.time(),
    lanterns: [],
    poem: { theta: 0, thetaDot: 0, leanDeg: 0 },
    fall: [],
    settled: false,
    heroStillFor: 0,
  };

  // ---- lanterns ----------------------------------------------------------

  const byId = (id: LanternId): LanternInternal | undefined =>
    lanterns.find((l) => l.spec.id === id);

  const applySpec = (l: LanternInternal, spec: LanternSpec): void => {
    const lengthWorld = Math.max(
      pxLengthToWorld(spec.cordLengthPx, spec.z, viewport),
      0.01,
    );
    const omega2 = pendulumGravity(lengthWorld, spec.period) / lengthWorld;
    // Pivot → bottom collar ≈ cord + paper height; tassel length in body widths.
    const widthWorld = pxLengthToWorld(spec.body, spec.z, viewport);
    const collarWorld = lengthWorld + PAPER_ASPECT * widthWorld;
    const tasselWorld = PENDULUM.tassel.lengthBodyWidths * widthWorld;

    l.spec = spec;
    l.lengthWorld = lengthWorld;
    l.omega2 = omega2;
    l.omega = Math.sqrt(omega2);
    l.tasselDrive = Math.min(
      1 + collarWorld / Math.max(tasselWorld, 1e-3),
      PENDULUM.tassel.maxDrive,
    );
    l.centrePx = {
      x: spec.bodyRect.x + spec.bodyRect.w / 2,
      y: spec.bodyRect.y + spec.bodyRect.h / 2,
    };
    l.x01 = spec.x / viewport.w;
    l.state.id = spec.id;
    l.state.cordTarget = lengthWorld;
    pxToWorld(
      { x: spec.x, y: spec.cordAnchorY },
      viewport,
      spec.z,
      l.state.pivot,
    );
  };

  const freshLantern = (spec: LanternSpec, index: number): LanternInternal => {
    const l: LanternInternal = {
      spec,
      state: {
        id: spec.id,
        theta: 0,
        thetaDot: 0,
        cordLength: CORD_RAISED_WORLD,
        cordTarget: 0,
        lit: 0,
        litTarget: 0,
        pool: 0,
        candle: 1,
        tasselTheta: 0,
        tasselThetaDot: 0,
        bob: 0,
        bobDot: 0,
        rise: 0,
        alpha: 0,
        shadowScroll: hash01(index, 3, seed),
        zeta: PENDULUM.zetaIdle,
        pivot: { x: 0, y: 0, z: spec.z },
      },
      lengthWorld: 1,
      omega: 1,
      omega2: 1,
      tasselDrive: 1,
      centrePx: { x: 0, y: 0 },
      x01: 0,
      noiseSeed: seed + 1000 * (index + 1),
      cord: null,
      lightScript: null,
      poolScript: null,
      frozen: true,
      pending: 0,
      bodyAccel: 0,
    };

    applySpec(l, spec);

    return l;
  };

  const windAtLantern = (l: LanternInternal): number =>
    wind.sample(l.x01, state.ts) + wind.cursorForceAt(l.centrePx, viewport);

  const finishLower = (l: LanternInternal): void => {
    const s = l.state;
    const w = windAtLantern(l);
    const kick = PENDULUM.arrivalKick * w;

    s.cordLength = s.cordTarget;
    s.zeta = PENDULUM.zetaIdle;
    s.thetaDot += kick;
    s.tasselThetaDot -= kick;
    l.cord = null;
    l.frozen = false;
  };

  const advanceCord = (l: LanternInternal): void => {
    const script = l.cord;

    if (!script) return;

    const s = l.state;
    const t = clamp((state.ts - script.start) / script.durationS, 0, 1);

    if (script.kind === 'lower') {
      s.cordLength = lerp(script.from, script.to, ease.enter(t));
      if (t >= 1) finishLower(l);
    } else {
      const k = ease.exit(t);

      s.rise = lerp(0, script.to, k);
      s.alpha = 1 - k;
      if (t >= 1) l.cord = null;
    }
  };

  const advanceLight = (l: LanternInternal): void => {
    const script = l.lightScript;

    if (!script) return;

    const t = clamp((state.ts - script.start) / script.durationS, 0, 1);
    const k = script.to > script.from ? candleCatch(t) : ease[script.easing](t);

    l.state.lit = lerp(script.from, script.to, k);
    if (t >= 1) {
      l.state.lit = script.to;
      l.lightScript = null;
    }
  };

  /** The pool/halo row: its own delay and curve, never the wick keyframes. */
  const advancePool = (l: LanternInternal): void => {
    const script = l.poolScript;

    if (!script || state.ts < script.start) return;

    const t = clamp((state.ts - script.start) / script.durationS, 0, 1);

    l.state.pool = lerp(script.from, script.to, ease[script.easing](t));
    if (t >= 1) {
      l.state.pool = script.to;
      l.poolScript = null;
    }
  };

  const stepLantern = (l: LanternInternal, dt: number): void => {
    const s = l.state;

    advanceCord(l);
    advanceLight(l);
    advancePool(l);

    const w = windAtLantern(l);
    const lean = PENDULUM.leanPerW * w;
    const fy = wind.vertical();
    const n = Math.max(1, Math.ceil(dt / SUBSTEP_S));
    const h = dt / n;
    const tasselOmega =
      (2 * Math.PI) / (PENDULUM.tassel.periodFactor * l.spec.period);
    const bobOmega = (2 * Math.PI) / PENDULUM.bob.periodS;
    // Static bob of maxPx at the strongest scroll wind (Fy = clamp·scale).
    const bobGain =
      (PENDULUM.bob.maxPx * bobOmega * bobOmega) /
      (WIND.scroll.clamp * WIND.scroll.scale);

    for (let i = 0; i < n; i += 1) {
      let accel = 0;

      if (!l.frozen) {
        accel =
          -l.omega2 * (Math.sin(s.theta) - lean * Math.cos(s.theta)) -
          2 * s.zeta * l.omega * s.thetaDot;
        s.thetaDot += accel * h;
        s.theta += s.thetaDot * h;

        const lim = PENDULUM.idleClampRad;

        if (s.theta > lim) {
          s.theta = lim;
          if (s.thetaDot > 0) s.thetaDot = 0;
        } else if (s.theta < -lim) {
          s.theta = -lim;
          if (s.thetaDot < 0) s.thetaDot = 0;
        }
      }

      // The tassel restores toward plumb (absolute angle θ + ψ → 0) and is
      // driven by the collar's tangential acceleration (1 + R/l)·θ''; a cubic
      // term from `softRad` outward is the strands' weight leaning against a
      // large relative angle, so the clamp below is a safety, not the stop.
      const soft = s.tasselTheta / PENDULUM.tassel.softRad;
      const tasselAccel =
        -tasselOmega * tasselOmega * (s.tasselTheta + s.theta) -
        tasselOmega * tasselOmega * soft * soft * soft -
        2 * PENDULUM.tassel.zeta * tasselOmega * s.tasselThetaDot -
        l.tasselDrive * accel;

      s.tasselThetaDot += tasselAccel * h;
      s.tasselTheta += s.tasselThetaDot * h;

      const tasselLim = PENDULUM.tassel.clampRad;

      if (s.tasselTheta > tasselLim) {
        s.tasselTheta = tasselLim;
        if (s.tasselThetaDot > 0) s.tasselThetaDot = 0;
      } else if (s.tasselTheta < -tasselLim) {
        s.tasselTheta = -tasselLim;
        if (s.tasselThetaDot < 0) s.tasselThetaDot = 0;
      }

      const bobAccel =
        -bobOmega * bobOmega * s.bob -
        2 * PENDULUM.bob.zeta * bobOmega * s.bobDot -
        bobGain * fy;

      s.bobDot += bobAccel * h;
      s.bob += s.bobDot * h;
      if (Math.abs(s.bob) > PENDULUM.bob.maxPx) {
        s.bob = Math.sign(s.bob) * PENDULUM.bob.maxPx;
        if (Math.sign(s.bobDot) === Math.sign(s.bob)) s.bobDot = 0;
      }

      l.bodyAccel = accel;
    }

    const { amplitude, floor, hz1, hz2 } = lightRules.candle;
    const flicker =
      1 +
      amplitude *
        (valueNoise1(hz1 * state.ts, l.noiseSeed) +
          0.5 * valueNoise1(hz2 * state.ts, l.noiseSeed + 7));

    s.candle = Math.max(floor, flicker);

    const { pxPerS, waver, waverHz } = WIND.revolvingDrift;
    const drift =
      pxPerS * (1 + waver * valueNoise1(waverHz * state.ts, l.noiseSeed + 13));

    s.shadowScroll = (s.shadowScroll + (drift * dt) / SHADOW_STRIP_PX) % 1;
  };

  // ---- poem ----------------------------------------------------------------

  const stepPoem = (dt: number): void => {
    const p: PoemState = state.poem;
    const { lengthU, zeta, drive, renderScale, clampDeg } = PENDULUM.poem;
    const x01 = poemPx ? poemPx.x / viewport.w : 0.85;
    const cursor = poemPx ? wind.cursorForceAt(poemPx, viewport) : 0;
    const w = (wind.sample(x01, state.ts) + cursor) * drive;
    const lean = PENDULUM.leanPerW * w;
    const omega2 = POEM_GRAVITY / lengthU;
    const omega = Math.sqrt(omega2);
    const n = Math.max(1, Math.ceil(dt / SUBSTEP_S));
    const h = dt / n;

    for (let i = 0; i < n; i += 1) {
      const accel =
        -omega2 * (Math.sin(p.theta) - lean * Math.cos(p.theta)) -
        2 * zeta * omega * p.thetaDot;

      p.thetaDot += accel * h;
      p.theta += p.thetaDot * h;
    }

    p.leanDeg = clamp(p.theta * renderScale * DEG, -clampDeg, clampDeg);
  };

  // ---- florets -------------------------------------------------------------

  /**
   * Exact species counts per page (22 / 8 / 6 at 36, §5.2): the indices are
   * ranked by a seeded hash and the first `florets` ranks are florets, the
   * next `leaves` are leaves, the rest ginkgo. A phone gets florets only:
   * a 34 px leaf or a 40 px ginkgo fan beside the one 44 px lantern is the
   * size of the object (§3.3 mobile).
   */
  const buildSpeciesTable = (count: number, mobile: boolean): FallSpecies[] => {
    if (mobile) return new Array<FallSpecies>(count).fill('floret');

    const florets = Math.round(count * FALL_SPECIES_MIX.floret);
    const leaves = Math.round(count * FALL_SPECIES_MIX.leaf);
    const ranked = Array.from({ length: count }, (_, i) => i).sort(
      (a, b) => hash01(a, 21, seed) - hash01(b, 21, seed),
    );
    const table: FallSpecies[] = new Array(count);

    ranked.forEach((index, rank) => {
      table[index] =
        rank < florets ? 'floret' : rank < florets + leaves ? 'leaf' : 'ginkgo';
    });

    return table;
  };

  const pickEmitter = (index: number): number => {
    const emitters = layout.florets.emitters;

    if (emitters.length <= 1) return 0;

    const total = emitters.reduce((a, r) => a + r.w * r.h, 0);
    let pick = hash01(index, 29, seed) * total;

    for (let i = 0; i < emitters.length; i += 1) {
      pick -= emitters[i].w * emitters[i].h;
      if (pick <= 0) return i;
    }

    return emitters.length - 1;
  };

  const speciesColour = (f: FallInternal): Rgb01 => {
    const { inst, cycle } = f;
    const r = hash01(inst.index, 400 + cycle, seed);
    let warm: Rgb01;

    if (inst.species === 'floret') {
      let acc = 0;

      warm = FLORET_COLOURS[0].color;
      for (const c of FLORET_COLOURS) {
        acc += c.weight;
        if (r <= acc) {
          warm = c.color;
          break;
        }
      }
    } else if (inst.species === 'leaf') {
      warm = LEAF_TOP;
    } else {
      warm = mixRgb(GINKGO_FROM, GINKGO_TO, 0.4 + 0.3 * r);
    }

    if (!moonPx || layout.home) return warm;

    // Distances from the spawn point: the moon's light reaches florets that
    // are nearer to it than to any lantern (§2.3).
    const px = f.baseX;
    const py = f.live.y;
    const dMoon = Math.hypot(px - moonPx.x, py - moonPx.y);
    let dLantern = viewport.w / 2;

    for (const p of lanternsPx) {
      dLantern = Math.min(dLantern, Math.hypot(px - p.x, py - p.y));
    }

    return coolTowardMoon(warm, dMoon, dLantern);
  };

  const respawn = (f: FallInternal, atTop: boolean): void => {
    const { inst, live } = f;
    const margin = inst.sizePx / 2;

    if (f.exiting) {
      // The old emitter is gone: the rebirth belongs to the new rect.
      f.live.x = f.target.x;
      f.live.y = f.target.y;
      f.live.w = f.target.w;
      f.live.h = f.target.h;
    }
    f.exiting = false;
    f.reclamp = false;
    f.cycle += 1;
    f.baseX =
      live.x +
      margin +
      hash01(inst.index, 100 + f.cycle, seed) *
        Math.max(live.w - 2 * margin, 0);
    f.driftX = 0;
    f.outsideFor = 0;
    if (atTop) {
      const period = Math.max(inst.descentS * (live.h / viewport.h), 0.1);

      inst.phase = (((-state.ts / period) % 1) + 1) % 1;
      f.prevP = 0;
    }
    inst.color = speciesColour(f);
  };

  const freshFall = (index: number): FallInternal => {
    const species = speciesTable[index] ?? 'floret';
    const rule = FALL_SPECIES[species];
    const rng = mulberry32(seed * 7919 + index * 104729 + 17);
    const pick = (range: readonly [number, number]) =>
      range[0] + (range[1] - range[0]) * rng();
    // Florets keep to the near and mid bands: a 6–10 px corolla at the far
    // band's 0.45 scale is a 2–3 px soft dot, which is dust (§5.4), not a
    // floret. Leaves and ginkgo survive the far band at 10–18 px.
    const band = (species === 'floret' ? index % 2 : index % 3) as DepthBand;
    const emitter = pickEmitter(index);
    const rect = layout.florets.emitters[emitter] ?? { x: 0, y: 0, w: 1, h: 1 };
    const inst: FallInstance = {
      index,
      seed: hash01(index, 1, seed),
      species,
      band,
      atlasCell: rule.atlasCell,
      sizePx: pick(rule.sizePx),
      descentS: pick(rule.descentS),
      flutterHz: pick(FALL_FLUTTER_HZ),
      flutterAmpPx: pick(rule.flutterPx),
      spinRate: pick(rule.spin),
      tumble: rng() < rule.tumble,
      phase: rng(),
      color: [1, 1, 1],
      x: rect.x,
      y: rect.y,
      spin: rng() * Math.PI * 2,
      tilt: 0,
      alpha: 0,
      emitter,
    };
    const f: FallInternal = {
      inst,
      baseX: rect.x,
      driftX: 0,
      prevP: 0,
      cycle: 0,
      outsideFor: 0,
      live: { ...rect },
      target: { ...rect },
      reclamp: false,
      exiting: false,
      surplus: false,
      bornTs: -Infinity,
    };

    respawn(f, false);

    return f;
  };

  /** Nearest x inside `rect` (half a size in from each edge) for a base x. */
  const insideX = (x: number, rect: Rect, sizePx: number): number =>
    clamp(x, rect.x + sizePx / 2, rect.x + rect.w - sizePx / 2);

  /** Alpha multiplier from the emitter clip feather, the exclusions and `/`'s ramp. */
  const fieldAlpha = (x: number, y: number, live: Rect): number => {
    const { featherPx, exclusions, alphaRampY, alphaMax } = layout.florets;
    let a = alphaMax;

    if (featherPx > 0) {
      const inset = Math.min(
        x - live.x,
        live.x + live.w - x,
        y - live.y,
        live.y + live.h - y,
      );

      a *= smoothstep(0, featherPx, inset);
    }

    for (const r of exclusions) {
      const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
      const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
      const outside = Math.hypot(dx, dy);

      a *= smoothstep(0, Math.max(featherPx, 6), outside);
    }

    if (alphaRampY) {
      a *= 1 - smoothstep(alphaRampY[0], alphaRampY[1], y);
    }

    return a;
  };

  const stepFall = (dt: number): void => {
    const fy = wind.vertical();
    const liftPx =
      -WIND.scroll.floretLiftMaxPx *
      clamp(fy / (WIND.scroll.clamp * WIND.scroll.scale), -1, 1);
    const damp = 1 - Math.exp(-RECLAMP_LAMBDA * dt);

    for (const f of fall) {
      const { inst, live, target } = f;

      live.x += (target.x - live.x) * damp;
      live.y += (target.y - live.y) * damp;
      live.w += (target.w - live.w) * damp;
      live.h += (target.h - live.h) * damp;

      const period = Math.max(inst.descentS * (live.h / viewport.h), 0.1);
      const p = (((state.ts / period + inst.phase) % 1) + 1) % 1;

      // A surplus instance is on its way out: no rebirth mid-fade.
      if (p < f.prevP - 0.5 && !f.surplus) respawn(f, false);
      f.prevP = p;

      const y = live.y + p * live.h;
      const x01 = clamp(f.baseX / viewport.w, 0, 1);

      point.x = f.baseX + f.driftX;
      point.y = y;

      const w =
        wind.sample(x01, state.ts) +
        WIND.cursor.floretShare * wind.cursorForceAt(point, viewport);
      const curl = curl2(
        (f.baseX + f.driftX) / CURL_SCALE_PX,
        (y + CURL_DRIFT_PX_PER_S * state.ts) / CURL_SCALE_PX,
        seed + 5,
        curlOut,
        scratch,
      );

      f.driftX +=
        (WIND.floretDrift.perW * w + WIND.floretDrift.curl * curl.x) * dt;

      const flutterPhase =
        2 * Math.PI * (inst.flutterHz * state.ts + inst.seed);
      const x = f.baseX + f.driftX + inst.flutterAmpPx * Math.sin(flutterPhase);

      inst.spin += inst.spinRate * dt;
      inst.tilt = inst.tumble
        ? inst.tilt + inst.spinRate * 0.8 * dt
        : 0.35 * Math.sin(flutterPhase + inst.seed);

      const band = DEPTH_BANDS[inst.band];
      let alpha =
        band.alpha *
        smoothstep(0, 0.1, p) *
        (1 - smoothstep(0.9, 1, p)) *
        fieldAlpha(x, y, live);

      const margin = inst.sizePx;
      const outside = x < live.x - margin || x > live.x + live.w + margin;

      if (f.surplus) {
        // Beyond the new route's count: fade, then the tail is dropped below.
        f.outsideFor += dt;
        alpha *= 1 - clamp(f.outsideFor / OUTSIDE_FADE_S, 0, 1);
      } else if (f.exiting || (outside && !f.reclamp)) {
        f.outsideFor += dt;
        alpha *= 1 - clamp(f.outsideFor / OUTSIDE_FADE_S, 0, 1);
        if (f.outsideFor >= OUTSIDE_FADE_S) {
          respawn(f, true);
          alpha = 0;
        }
      } else {
        f.outsideFor = 0;
        if (f.reclamp) {
          // §4.2 bounds re-clamp: slide toward the nearest inside x, λ 8.
          const here = f.baseX + f.driftX;
          const nearest = insideX(here, target, inst.sizePx);

          f.baseX += (nearest - here) * damp;
          if (Math.abs(nearest - here) < 0.5) f.reclamp = false;
        }
      }
      alpha *= clamp((state.ts - f.bornTs) / BIRTH_FADE_S, 0, 1);

      inst.x = x;
      inst.y = y + liftPx;
      inst.alpha = alpha;
    }

    // Surplus instances sit at the tail; drop them once their fade is done.
    let dropped = false;

    while (
      fall.length &&
      fall[fall.length - 1].surplus &&
      fall[fall.length - 1].outsideFor >= OUTSIDE_FADE_S
    ) {
      fall.pop();
      dropped = true;
    }
    if (dropped) state.fall = fall.map((f) => f.inst);
  };

  const rebuildFall = (reason: 'mount' | 'route' | 'resize'): void => {
    const count = layout.florets.count;
    const emitters = layout.florets.emitters;

    if (emitters.length === 0 || count === 0) {
      fall.length = 0;
      state.fall = [];

      return;
    }

    if (speciesTable.length !== count || speciesMobile !== layout.mobile) {
      speciesTable = buildSpeciesTable(count, layout.mobile);
      speciesMobile = layout.mobile;
    }
    if (reason !== 'route') fall.length = Math.min(fall.length, count);
    for (let i = 0; i < fall.length; i += 1) {
      const f = fall[i];

      if (reason !== 'route') {
        const emitter = pickEmitter(i);
        const rect = emitters[emitter];

        f.inst.emitter = emitter;
        f.target = { ...rect };
        f.live = { ...rect };
        f.baseX = insideX(f.baseX, rect, f.inst.sizePx);
        f.reclamp = false;
        f.exiting = false;
        f.surplus = false;
        continue;
      }

      // §0.9 / §4.2: florets never exit on a route change. Beyond the new
      // count an instance fades and is dropped; otherwise it keeps its
      // emitter index when that emitter still exists and its new rect is
      // within reach, sliding in (damp λ 8), and only an instance whose
      // emitter is gone fades and respawns inside a freshly picked one.
      f.surplus = i >= count;
      if (f.surplus) continue;

      const kept = f.inst.emitter < emitters.length ? f.inst.emitter : -1;
      const keptRect = kept >= 0 ? emitters[kept] : null;
      const here = f.baseX + f.driftX;
      const reach =
        keptRect === null
          ? Infinity
          : Math.abs(insideX(here, keptRect, f.inst.sizePx) - here);

      if (keptRect && reach <= RECLAMP_REACH_PX) {
        f.target = { ...keptRect };
        f.reclamp = reach > 0;
        f.exiting = false;
      } else {
        const emitter = pickEmitter(i);

        f.inst.emitter = emitter;
        f.target = { ...emitters[emitter] };
        f.reclamp = false;
        f.exiting = true;
        f.outsideFor = 0;
      }
    }
    for (let i = fall.length; i < count; i += 1) {
      const f = freshFall(i);

      if (reason === 'route') f.bornTs = state.ts;
      fall.push(f);
    }
    state.fall = fall.map((f) => f.inst);
  };

  // ---- settle ---------------------------------------------------------------

  const stepSettle = (dt: number): void => {
    const elapsed = state.ts - sequenceStart;
    let atLength = true;
    let lit = true;

    for (const l of lanterns) {
      const s = l.state;
      // A lantern parked by the mobile scroll-lift (raised, hidden, no
      // script pending) is at rest too: the page settles with it up.
      const parked = s.rise !== 0 && s.alpha === 0;

      if (
        l.cord ||
        l.pending > 0 ||
        s.cordLength !== s.cordTarget ||
        (s.rise !== 0 && !parked)
      ) {
        atLength = false;
      }
      if (l.lightScript || s.lit !== s.litTarget) lit = false;
    }

    if (
      hero &&
      atLength &&
      Math.abs(hero.state.theta) * DEG < PENDULUM.settle.thresholdDeg
    ) {
      state.heroStillFor += dt;
    } else {
      state.heroStillFor = 0;
    }

    if (!settledLatch && elapsed >= gate.floorS) {
      const still =
        state.heroStillFor >= PENDULUM.settle.holdS || elapsed >= gate.ceilingS;

      if (lanterns.length === 0 || (atLength && lit && still)) {
        settledLatch = true;
      }
    }
    state.settled = settledLatch;
  };

  // ---- schedule queue ---------------------------------------------------------

  const enqueue = (ts: number, fn: () => void): void => {
    queue.push({ ts, fn, order: queueOrder });
    queueOrder += 1;
    queue.sort((a, b) => a.ts - b.ts || a.order - b.order);
  };

  const drain = (): void => {
    while (queue.length && queue[0].ts <= state.ts) {
      const job = queue.shift() as Scheduled;

      job.fn();
    }
  };

  const resetSequence = (reason: 'mount' | 'route'): void => {
    sequenceStart = state.ts;
    gate = SETTLE_GATES[reason];
    settledLatch = false;
    state.settled = false;
    state.heroStillFor = 0;
  };

  // ---- layout -----------------------------------------------------------------

  const applyLayout = (
    next: RouteLayout,
    reason: 'mount' | 'route' | 'resize',
  ): void => {
    layout = next;
    viewport = next.viewport;

    const kept: LanternInternal[] = [];

    next.lanterns.forEach((spec, index) => {
      const existing = byId(spec.id);

      if (existing && reason !== 'mount') {
        const wasAtLength =
          existing.state.cordLength === existing.state.cordTarget;

        applySpec(existing, spec);
        if (wasAtLength && !existing.cord) {
          existing.state.cordLength = existing.state.cordTarget;
        }
        kept.push(existing);
      } else {
        kept.push(freshLantern(spec, index));
      }
    });
    lanterns.length = 0;
    lanterns.push(...kept);
    state.lanterns = lanterns.map((l) => l.state);
    hero = lanterns.find((l) => l.spec.hero) ?? lanterns[0] ?? null;

    moonPx = next.moon ? { ...next.moon.centre } : null;
    lanternsPx = next.lanterns.map((s) => ({
      x: s.bodyRect.x + s.bodyRect.w / 2,
      y: s.bodyRect.y + s.bodyRect.h / 2,
    }));

    const poem = next.text.poem;

    poemPx = poem ? { x: poem.x + poem.w / 2, y: poem.y + poem.h / 2 } : null;

    rebuildFall(reason);
    if (reason !== 'resize') resetSequence(reason);
  };

  // ---- the API ------------------------------------------------------------------

  const api: SimApi = {
    state,

    step(dt) {
      if (!(dt > 0)) return;

      state.ts += dt;
      drain();
      for (const l of lanterns) stepLantern(l, dt);
      stepPoem(dt);
      stepFall(dt);
      stepSettle(dt);
    },

    prewarm(seconds) {
      const ts0 = state.ts;
      const dt = 1 / 30;
      const steps = Math.ceil(seconds / dt);

      state.ts = ts0 - steps * dt;
      for (let i = 0; i < steps; i += 1) {
        state.ts += dt;
        stepFall(dt);
      }
      state.ts = ts0;
    },

    setLayout(next, reason) {
      applyLayout(next, reason);
    },

    setNight(next) {
      night = next;
    },

    lowerIn(id, { delayS, durationS }) {
      const l = byId(id);

      if (!l) return;
      l.pending += 1;
      settledLatch = false;
      enqueue(state.ts + delayS, () => {
        const s = l.state;

        l.pending -= 1;
        l.frozen = false;
        // A lantern re-hung on a new page starts from a fresh hang: the pivot
        // moved, so the old swing, tassel and bob have no meaning here.
        s.theta = 0;
        s.thetaDot = 0;
        s.tasselTheta = 0;
        s.tasselThetaDot = 0;
        s.bob = 0;
        s.bobDot = 0;
        s.rise = 0;
        s.alpha = 1;
        s.zeta = PENDULUM.zetaScripted;
        s.cordLength = CORD_RAISED_WORLD;
        l.cord = {
          kind: 'lower',
          start: state.ts,
          durationS: Math.max(durationS, 1e-3),
          from: CORD_RAISED_WORLD,
          to: s.cordTarget,
        };
        if (durationS <= 0) {
          s.cordLength = s.cordTarget;
          finishLower(l);
        }
      });
    },

    raise(id, { delayS, durationS, px }) {
      const l = byId(id);

      if (!l) return;
      l.pending += 1;
      settledLatch = false;
      enqueue(state.ts + delayS, () => {
        l.pending -= 1;
        l.frozen = true;
        l.state.zeta = PENDULUM.zetaScripted;
        l.state.thetaDot = 0;
        l.cord = {
          kind: 'raise',
          start: state.ts,
          durationS: Math.max(durationS, 1e-3),
          from: 0,
          to: px,
        };
        if (durationS <= 0) {
          l.state.rise = px;
          l.state.alpha = 0;
          l.cord = null;
        }
      });
    },

    light(
      id,
      {
        delayS,
        durationS,
        target,
        easing,
        poolDelayS,
        poolDurationS,
      }: LightOptions,
    ) {
      const l = byId(id);

      if (!l) return;
      l.state.litTarget = target;
      enqueue(state.ts + delayS, () => {
        // A later light() (a theme flip, a route exit) superseded this one.
        if (l.state.litTarget !== target) return;

        const catching = target > l.state.lit;

        if (durationS <= 0) {
          l.state.lit = target;
          l.state.pool = target;
          l.lightScript = null;
          l.poolScript = null;

          return;
        }
        l.lightScript = {
          start: state.ts,
          durationS,
          from: l.state.lit,
          to: target,
          easing: easing ?? 'snuff',
        };
        l.poolScript = {
          start: state.ts + (poolDelayS ?? (catching ? POOL_DELAY_S : 0)),
          durationS: Math.max(
            poolDurationS ?? (catching ? POOL_MS_S : durationS),
            1e-3,
          ),
          from: l.state.pool,
          to: target,
          easing: catching ? 'pool' : (easing ?? 'snuff'),
        };
      });
    },

    tap(point) {
      const { kickRadPerS, radiusVw } = WIND.touch;
      const direction = point.x < viewport.w / 2 ? 1 : -1;

      for (const l of lanterns) {
        if (l.frozen) continue;

        const dist = Math.hypot(point.x - l.centrePx.x, point.y - l.centrePx.y);
        const falloff = 1 - smoothstep(0, radiusVw * viewport.w, dist);

        l.state.thetaDot += kickRadPerS * falloff * direction;
      }
    },

    schedule(ts, fn) {
      enqueue(ts, fn);
    },

    setSequenceStart(ts) {
      sequenceStart = ts;
    },

    setEmitterRect(index, rect) {
      const emitter = layout.florets.emitters[index];

      if (!emitter) return;
      emitter.x = rect.x;
      emitter.y = rect.y;
      emitter.w = rect.w;
      emitter.h = rect.h;
      for (const f of fall) {
        if (f.inst.emitter !== index) continue;
        f.target.x = f.live.x = rect.x;
        f.target.y = f.live.y = rect.y;
        f.target.w = f.live.w = rect.w;
        f.target.h = f.live.h = rect.h;
        f.baseX = clamp(
          f.baseX,
          rect.x + f.inst.sizePx / 2,
          rect.x + rect.w - f.inst.sizePx / 2,
        );
      }
    },

    snapshotLift(lifted, px) {
      queue.length = 0;
      for (const l of lanterns) {
        const s = l.state;
        const lit = lifted ? 0 : layout.ignoresTheme ? 1 : night;

        l.cord = null;
        l.lightScript = null;
        l.poolScript = null;
        l.pending = 0;
        l.frozen = lifted;
        s.thetaDot = 0;
        s.cordLength = s.cordTarget;
        s.lit = lit;
        s.litTarget = lit;
        s.pool = lit;
        s.rise = lifted ? px : 0;
        s.alpha = lifted ? 0 : 1;
      }

      return state;
    },

    snapshotReduced() {
      queue.length = 0;
      for (const l of lanterns) {
        const s = l.state;
        const lit = layout.ignoresTheme ? 1 : night;

        l.cord = null;
        l.lightScript = null;
        l.poolScript = null;
        l.pending = 0;
        l.frozen = false;
        s.theta = 0.03;
        s.thetaDot = 0;
        s.cordLength = s.cordTarget;
        s.lit = lit;
        s.litTarget = lit;
        s.pool = lit;
        s.candle = 1;
        s.tasselTheta = 0;
        s.tasselThetaDot = 0;
        s.bob = 0;
        s.bobDot = 0;
        s.rise = 0;
        s.alpha = 1;
        s.shadowScroll = REDUCED_SHADOW_SCROLL;
        s.zeta = PENDULUM.zetaIdle;
      }
      state.poem.theta = 0;
      state.poem.thetaDot = 0;
      state.poem.leanDeg = 0;
      state.heroStillFor = PENDULUM.settle.holdS;
      settledLatch = true;
      state.settled = true;

      return state;
    },

    dispose() {
      queue.length = 0;
      lanterns.length = 0;
      fall.length = 0;
      state.lanterns = [];
      state.fall = [];
    },
  };

  applyLayout(options.layout, 'mount');

  return api;
}
