/**
 * The one wind field W(x, ts) of the Mid-Autumn layer (bible §4.4, §4.5, §7.1).
 *
 * `createWind(seed)` returns the module-scope singleton kept on
 * `globalThis.__festivalWind`, so React StrictMode's double mount, HMR and
 * route changes never restart the weather: pages are rooms in one evening.
 * `createWindInstance(seed)` builds a private, non-shared field for tests.
 *
 * The field is dimensionless. It enters the pendulum as a quasi-static lean
 * `θ_eq = 0.04 · W` (sim.ts). Components:
 *
 * - breeze: 2-octave fBm over ts / 9 s, amplitude 0.5, spatial phase 0.7·x;
 * - gust train: seeded events, first at 4.4 s (A 1.8, L → R), then every
 *   U(12, 18) s with A ∈ [1.2, 2.2], L → R 80 %; each is a travelling front at
 *   0.55 vw/s whose envelope at a point rises over 350 ms (smoothstep), holds
 *   200 ms and decays exp(−t / 1.4 s);
 * - touch: a local gust A 0.6, (1 − cos) over 1.2 s, radius 0.35 vw, at most
 *   once per 3 s;
 * - cursor: `Fc = clamp(vx / 900, −1, 1) × 6`, decaying exp(−3.5 dt). It has a
 *   2-D falloff per object, so it is NOT folded into `sample()`; the sim adds
 *   `cursorForceAt(objectPx)` per lantern (florets take 0.25 of it);
 * - scroll: `Fy = clamp(v, −3, 3) × 0.25`, vertical, decaying exp(−4 dt),
 *   read through `vertical()`.
 *
 * The clock: `tick(nowMs)` advances `ts` by a wall-clock delta clamped to
 * 33 ms, returns 0 while paused and drops the last timestamp on pause so a
 * hidden tab produces zero steps and no burst on return (§4.7). The scheduler
 * runs on sim time, so gusts never pile up while hidden.
 *
 * No DOM here except the listener helpers at the bottom, which take the
 * window as a parameter and are guarded by ownership tokens.
 */

import { PENDULUM, WIND } from './types.ts';
import type { GustSpec, Vec2, WindApi } from './types.ts';
import { clamp, fbm1, mulberry32, smoothstep } from './noise.ts';
import type { Rng } from './noise.ts';

export const WIND_SINGLETON_VERSION = 1;

/** How far ahead (s) the scheduler keeps gusts queued. */
const GUST_HORIZON_S = 40;
/**
 * While no layer is mounted (`/terminal`) the clock is not ticked; on the
 * next claim it catches up by the wall time elapsed, capped here, so a gust
 * in flight has finished and the evening has moved on (§3.7, §4.7).
 */
const UNMOUNTED_CATCHUP_MAX_S = 60;
/** Extra life after a front has crossed the viewport before it is dropped (s). */
const GUST_TAIL_S = 12;

// ---------------------------------------------------------------------------
// Pure field helpers (exported for the tests and `window.__festival.wind`)
// ---------------------------------------------------------------------------

/** Breeze term at `x01` (viewport widths) and `ts` (s). */
export function breezeAt(x01: number, ts: number, seed: number): number {
  const { periodS, amplitude, spatialPhase, octaves } = WIND.breeze;

  return amplitude * fbm1(ts / periodS + spatialPhase * x01, seed, octaves);
}

/** When a gust front reaches `x01` (s of sim time). */
export function gustArrival(gust: GustSpec, x01: number): number {
  return gust.at + ((x01 - gust.originX01) * gust.direction) / gust.speedVw;
}

/** Envelope of one front at a point, `tau` seconds after arrival (0..1). */
export function gustEnvelope(tau: number): number {
  const rise = WIND.gust.riseMs / 1000;
  const hold = WIND.gust.holdMs / 1000;

  if (tau <= 0) return 0;
  if (tau < rise) return smoothstep(0, rise, tau);
  if (tau < rise + hold) return 1;

  return Math.exp(-(tau - rise - hold) / WIND.gust.decayS);
}

/** Sum of all gust fronts at `x01`, signed by direction. */
export function gustField(
  gusts: readonly GustSpec[],
  x01: number,
  ts: number,
): number {
  let w = 0;

  for (const g of gusts) {
    w += g.amplitude * g.direction * gustEnvelope(ts - gustArrival(g, x01));
  }

  return w;
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

type TouchGust = { at: number; x01: number; radiusVw: number };

export interface WindInstanceOptions {
  /** `false` disables the gust train (tests measure the breeze-only baseline). */
  gusts?: boolean;
}

/** A private wind field (not the singleton). */
export function createWindInstance(
  seed: number,
  options: WindInstanceOptions = {},
): WindApi {
  const gustsEnabled = options.gusts !== false;

  let currentSeed = seed;
  let rng: Rng = mulberry32(seed);
  let ts = 0;
  let lastMs: number | null = null;
  let isPaused = false;

  let gusts: GustSpec[] = [];
  let lastGustAt = 0;

  let cursorForce = 0;
  let pointer: Vec2 | null = null;
  let scrollForce = 0;
  let lastTouchAt = -Infinity;
  let touchGust: TouchGust | null = null;

  const resetSchedule = (): void => {
    gusts = [];
    lastGustAt = WIND.gust.firstAtS;
    if (!gustsEnabled) return;
    gusts.push({
      at: WIND.gust.firstAtS,
      amplitude: WIND.gust.firstAmplitude,
      direction: 1,
      speedVw: WIND.gust.speedVw,
      originX01: -0.1,
    });
  };

  const nextGust = (): GustSpec => {
    const [i0, i1] = WIND.gust.intervalS;
    const [a0, a1] = WIND.gust.amplitude;
    const interval = i0 + (i1 - i0) * rng();
    const amplitude = a0 + (a1 - a0) * rng();
    const direction: 1 | -1 = rng() < WIND.gust.leftToRightProbability ? 1 : -1;

    lastGustAt += interval;

    return {
      at: lastGustAt,
      amplitude,
      direction,
      speedVw: WIND.gust.speedVw,
      originX01: direction === 1 ? -0.1 : 1.1,
    };
  };

  /** Keeps the train topped up to the horizon and drops spent fronts. */
  const maintain = (): void => {
    if (gustsEnabled) {
      while (lastGustAt < ts + GUST_HORIZON_S) gusts.push(nextGust());
    }
    if (
      gusts.length &&
      gusts[0].at + 1.2 / WIND.gust.speedVw + GUST_TAIL_S < ts
    ) {
      gusts = gusts.filter((g) => g.at + 1.2 / g.speedVw + GUST_TAIL_S >= ts);
    }
  };

  const touchAt = (x01: number, at: number): number => {
    if (!touchGust) return 0;

    const tau = at - touchGust.at;

    if (tau < 0 || tau > WIND.touch.durationS) return 0;

    const envelope =
      0.5 * (1 - Math.cos((2 * Math.PI * tau) / WIND.touch.durationS));
    const falloff =
      1 - smoothstep(0, touchGust.radiusVw, Math.abs(x01 - touchGust.x01));
    const direction = touchGust.x01 < 0.5 ? 1 : -1;

    return WIND.touch.amplitude * direction * envelope * falloff;
  };

  resetSchedule();

  const api: WindApi = {
    time: () => ts,

    tick(nowMs) {
      if (isPaused) return 0;
      if (lastMs === null) {
        lastMs = nowMs;

        return 0;
      }

      const dt = clamp((nowMs - lastMs) / 1000, 0, PENDULUM.dtClampS);

      lastMs = nowMs;
      ts += dt;
      cursorForce *= Math.exp(-WIND.cursor.decay * dt);
      scrollForce *= Math.exp(-WIND.scroll.decay * dt);
      maintain();

      return dt;
    },

    sample(x01, at = ts) {
      return (
        breezeAt(x01, at, currentSeed) +
        gustField(gusts, x01, at) +
        touchAt(x01, at)
      );
    },

    vertical: () => scrollForce,

    cursor(vxPxPerS, point) {
      const { velocityScale, maxForce } = WIND.cursor;

      cursorForce = clamp(vxPxPerS / velocityScale, -1, 1) * maxForce;
      if (point) pointer = { x: point.x, y: point.y };
    },

    cursorForceAt(point, viewport) {
      if (!pointer || cursorForce === 0) return 0;

      const dist = Math.hypot(point.x - pointer.x, point.y - pointer.y);

      return (
        cursorForce *
        (1 - smoothstep(0, WIND.cursor.radiusVw * viewport.w, dist))
      );
    },

    touch(point, viewport) {
      if (ts - lastTouchAt < WIND.touch.minIntervalS) return;
      lastTouchAt = ts;
      touchGust = {
        at: ts,
        x01: point.x / viewport.w,
        radiusVw: WIND.touch.radiusVw,
      };
    },

    scroll(velocityVhPerS) {
      const { clamp: lim, scale } = WIND.scroll;

      scrollForce = clamp(velocityVhPerS, -lim, lim) * scale;
    },

    scheduleGust(gust) {
      const direction: 1 | -1 = gust.direction ?? 1;
      const spec: GustSpec = {
        at: gust.at,
        amplitude: gust.amplitude ?? WIND.gust.firstAmplitude,
        direction,
        speedVw: gust.speedVw ?? WIND.gust.speedVw,
        originX01: gust.originX01 ?? (direction === 1 ? -0.1 : 1.1),
      };

      gusts.push(spec);
      gusts.sort((a, b) => a.at - b.at);
    },

    gusts: () => gusts,

    pause() {
      isPaused = true;
      lastMs = null;
    },

    resume() {
      isPaused = false;
      lastMs = null;
    },

    paused: () => isPaused,

    advance(seconds) {
      if (!(seconds > 0)) return;
      ts += seconds;
      cursorForce = 0;
      scrollForce = 0;
      maintain();
    },

    reseed(nextSeed) {
      currentSeed = nextSeed;
      rng = mulberry32(nextSeed);
      resetSchedule();
      maintain();
    },

    seed: () => currentSeed,

    random: () => rng(),
  };

  maintain();

  return api;
}

// ---------------------------------------------------------------------------
// The module-scope singleton (§7.1)
// ---------------------------------------------------------------------------

type WindSingleton = {
  version: number;
  wind: WindApi;
  /** Token of whoever currently owns the DOM listeners, or null. */
  listenerOwner: symbol | null;
  detach: (() => void) | null;
  /** Wall time (ms) the last layer released the listeners; null while one owns them. */
  releasedAtMs: number | null;
};

type WindGlobal = typeof globalThis & { __festivalWind?: WindSingleton };

function singleton(): WindSingleton | null {
  const g = globalThis as WindGlobal;
  const s = g.__festivalWind;

  return s && s.version === WIND_SINGLETON_VERSION ? s : null;
}

/**
 * The shared wind. Created once per page lifetime; a later call with a
 * different seed reseeds it (the `?festival-seed` gate), the same seed leaves
 * the clock and the gust train untouched.
 */
export function createWind(seed: number): WindApi {
  const existing = singleton();

  if (existing) {
    if (existing.wind.seed() !== seed) existing.wind.reseed(seed);

    return existing.wind;
  }

  const wind = createWindInstance(seed);
  const s: WindSingleton = {
    version: WIND_SINGLETON_VERSION,
    wind,
    listenerOwner: null,
    detach: null,
    releasedAtMs: null,
  };

  (globalThis as WindGlobal).__festivalWind = s;

  return wind;
}

/** The singleton if it exists (debug and tests). */
export function currentWind(): WindApi | null {
  return singleton()?.wind ?? null;
}

/** Drops the singleton (HMR dispose, tests). Listeners are detached first. */
export function disposeWind(): void {
  const s = singleton();

  if (!s) return;
  s.detach?.();
  delete (globalThis as WindGlobal).__festivalWind;
}

// ---------------------------------------------------------------------------
// Listener helpers (take the window; the sim stays testable)
// ---------------------------------------------------------------------------

/** The slice of `Window` the listeners need; a test can pass a stub. */
export interface WindWindow {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  readonly innerHeight: number;
  readonly scrollY: number;
  readonly document: {
    readonly hidden: boolean;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
  };
  readonly performance?: { now(): number };
}

export type WindListenerToken = symbol;

/**
 * Registers `visibilitychange` (pause / resume) and `scroll` (velocity in
 * vh/s) once. Returns an ownership token, or null when another mount already
 * owns the listeners (StrictMode's first mount, an HMR twin). Only the owner
 * can release them.
 */
export function claimWindListeners(
  win: WindWindow,
  wind: WindApi | null = currentWind(),
): WindListenerToken | null {
  const s = singleton();

  if (!s || !wind) return null;
  if (s.listenerOwner) return null;

  const now = () => win.performance?.now() ?? Date.now();
  let lastScrollY = win.scrollY;
  let lastScrollMs = now();

  const onVisibility = (): void => {
    if (win.document.hidden) wind.pause();
    else wind.resume();
  };

  const onScroll = (): void => {
    const t = now();
    const dtS = Math.max((t - lastScrollMs) / 1000, 1 / 240);
    const dy = win.scrollY - lastScrollY;

    lastScrollY = win.scrollY;
    lastScrollMs = t;
    wind.scroll(dy / Math.max(win.innerHeight, 1) / dtS);
  };

  win.document.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('scroll', onScroll);
  if (win.document.hidden) wind.pause();
  // The evening continued while the layer was away: advance by the wall time
  // since the last release (capped), so scheduled gusts stay consistent.
  if (s.releasedAtMs !== null) {
    wind.advance(
      Math.min((now() - s.releasedAtMs) / 1000, UNMOUNTED_CATCHUP_MAX_S),
    );
    s.releasedAtMs = null;
  }

  const token = Symbol('festival-wind-listeners');

  s.listenerOwner = token;
  s.detach = () => {
    win.document.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('scroll', onScroll);
    s.listenerOwner = null;
    s.detach = null;
    s.releasedAtMs = now();
  };

  return token;
}

/** Removes the listeners if `token` is the current owner; otherwise a no-op. */
export function releaseWindListeners(token: WindListenerToken | null): void {
  const s = singleton();

  if (!s || !token || s.listenerOwner !== token) return;
  s.detach?.();
}

// HMR: a replaced module must not leave a second clock behind (§7.1).
const hot = (
  import.meta as ImportMeta & {
    webpackHot?: { dispose(cb: () => void): void };
  }
).webpackHot;

hot?.dispose(() => disposeWind());
