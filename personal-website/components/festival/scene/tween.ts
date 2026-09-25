/**
 * The runtime's small tween: a from → to over `dur` seconds of sim time with
 * an easing, read with `tweenAt`. Shared by the moon controller, the theme
 * sampler and the canvas's own sky / floret fades.
 */

import { cubicBezier, clamp } from './noise.ts';
import { EASINGS } from './types.ts';

export type Tween = {
  from: number;
  to: number;
  /** Sim time (s) the tween started. */
  start: number;
  /** Seconds. */
  dur: number;
  ease: (t: number) => number;
};

export const easeStd = cubicBezier(...EASINGS.std);
export const easeLinear = (t: number): number => clamp(t, 0, 1);

/** The tween's value at `ts`, or `fallback` when there is no tween. */
export function tweenAt(t: Tween | null, ts: number, fallback: number): number {
  if (!t) return fallback;
  if (t.dur <= 0) return t.to;

  const k = clamp((ts - t.start) / t.dur, 0, 1);

  return t.from + (t.to - t.from) * t.ease(k);
}

export function tween(
  from: number,
  to: number,
  start: number,
  durMs: number,
  ease = easeStd,
): Tween {
  return { from, to, start, dur: durMs / 1000, ease };
}

/** True once `ts` is past the tween's end (or there is none). */
export function tweenDone(t: Tween | null, ts: number): boolean {
  return !t || ts >= t.start + t.dur;
}
