/**
 * Seeded randomness for the Mid-Autumn sim and wind (bible §4.5, §7.1).
 *
 * Everything here is pure and deterministic: the same seed always yields the
 * same sequence, so `?festival-seed=<n>` reproduces a capture exactly and the
 * node tests can compare two runs. No DOM, no three.
 *
 * - `mulberry32`: a tiny 32-bit PRNG (0..1).
 * - `hash01`: a stateless integer hash → 0..1, for per-instance constants.
 * - `valueNoise1` / `fbm1`: smooth 1-D noise in [−1, 1] (breeze, flicker,
 *   the 走马灯 waver).
 * - `simplex2`: 2-D simplex noise with its analytic gradient, so a curl field
 *   costs one evaluation per sample (≤ 36 per frame for the florets).
 */

export type Rng = () => number;

/** mulberry32, seeded from any finite number. */
export function mulberry32(seed: number): Rng {
  let a = Math.floor(seed) >>> 0 || 0x9e3779b9;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash of (i, j, seed) → 0..1, stateless. */
export function hash01(i: number, j = 0, seed = 0): number {
  let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1)) >>> 0;

  h = (h ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;

  return (h >>> 0) / 4294967296;
}

/** Hermite smoothstep on 0..1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 1-D value noise in [−1, 1], C1-smooth, period-free. */
export function valueNoise1(t: number, seed = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(i, 11, seed) * 2 - 1;
  const b = hash01(i + 1, 11, seed) * 2 - 1;

  return lerp(a, b, u);
}

/** Fractal sum of `octaves` value-noise layers, normalised back to [−1, 1]. */
export function fbm1(t: number, seed = 0, octaves = 2): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;

  for (let k = 0; k < octaves; k += 1) {
    sum += amp * valueNoise1(t * freq + k * 17.31, seed + k * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }

  return sum / norm;
}

// ---------------------------------------------------------------------------
// 2-D simplex noise with analytic derivatives (Gustavson / McEwan form)
// ---------------------------------------------------------------------------

export type NoiseSample = { value: number; dx: number; dy: number };

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD2: readonly (readonly [number, number])[] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function grad2(
  ix: number,
  iy: number,
  seed: number,
): readonly [number, number] {
  return GRAD2[Math.floor(hash01(ix, iy, seed) * 8) & 7];
}

/** Corner accumulator for `simplex2`, module-level so no closure is built per call. */
const _acc: NoiseSample = { value: 0, dx: 0, dy: 0 };

function simplexCorner(
  cx: number,
  cy: number,
  gi: number,
  gj: number,
  seed: number,
  acc: NoiseSample,
): void {
  let tt = 0.5 - cx * cx - cy * cy;

  if (tt < 0) return;

  const g = grad2(gi, gj, seed);
  const dot = g[0] * cx + g[1] * cy;
  const t2 = tt * tt;
  const t4 = t2 * t2;

  acc.value += t4 * dot;
  // d/dx of (t^4 · dot) = 4 t^3 · (−2 cx) · dot + t^4 · gx
  tt = -8 * tt * t2 * dot;
  acc.dx += tt * cx + t4 * g[0];
  acc.dy += tt * cy + t4 * g[1];
}

/**
 * 2-D simplex noise in roughly [−1, 1] with its gradient. `out` is reused so
 * the per-frame floret loop allocates nothing (≤ 36 calls per frame, no
 * closure per call).
 */
export function simplex2(
  x: number,
  y: number,
  seed: number,
  out: NoiseSample = { value: 0, dx: 0, dy: 0 },
): NoiseSample {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  _acc.value = 0;
  _acc.dx = 0;
  _acc.dy = 0;
  simplexCorner(x0, y0, i, j, seed, _acc);
  simplexCorner(x1, y1, i + i1, j + j1, seed, _acc);
  simplexCorner(x2, y2, i + 1, j + 1, seed, _acc);

  const { value, dx, dy } = _acc;

  out.value = 70 * value;
  out.dx = 70 * dx;
  out.dy = 70 * dy;

  return out;
}

/** Curl of the simplex scalar field: divergence-free, so drifting things never clump. */
export function curl2(
  x: number,
  y: number,
  seed: number,
  out: { x: number; y: number } = { x: 0, y: 0 },
  scratch: NoiseSample = { value: 0, dx: 0, dy: 0 },
): { x: number; y: number } {
  const n = simplex2(x, y, seed, scratch);

  out.x = n.dy;
  out.y = -n.dx;

  return out;
}

/** Cubic-bezier easing `(x1, y1, x2, y2)` → `t ↦ y`, solved by Newton then bisection. */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    let u = t;

    for (let k = 0; k < 6; k += 1) {
      const dx = sampleX(u) - t;

      if (Math.abs(dx) < 1e-5) return sampleY(u);

      const slope = slopeX(u);

      if (Math.abs(slope) < 1e-6) break;
      u -= dx / slope;
    }

    let lo = 0;
    let hi = 1;

    u = t;
    for (let k = 0; k < 24; k += 1) {
      const dx = sampleX(u) - t;

      if (Math.abs(dx) < 1e-5) break;
      if (dx > 0) hi = u;
      else lo = u;
      u = (lo + hi) / 2;
    }

    return sampleY(u);
  };
}
