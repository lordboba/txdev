/**
 * The moon's state machine (bible §4.1–4.3, §3.4, §4.5): the anchor glide or
 * fade between routes, the `/blog/[slug]` scroll dim, the moon's own
 * day/night blend (`uNight` in moon.ts: 900 ms std to full, 500 ms back to
 * the 7% daytime disc) and the pointer parallax offset.
 *
 * Every caller that changes the theme target goes through `setNight()`, so
 * a route change into the light theme can no longer leave the blend at 1
 * (a full night moon beside unlit lanterns). `state` is the anchor the
 * layout resolved, glided; the pointer parallax (§4.5: 0.85) is added by the
 * canvas from `FrameContext.parallax` when it draws and pins the disc.
 *
 * DOM-free; the canvas hands it sim time.
 */

import { light as lightRules } from '../palette.ts';
import { tween, tweenAt, tweenDone, type Tween } from './tween.ts';
import {
  CHOREOGRAPHY,
  type MoonState,
  type Rect,
  type RouteLayout,
  type Vec2,
} from './types.ts';

const MOUNT = CHOREOGRAPHY.mount;
const ROUTE = CHOREOGRAPHY.route;
const THEME = CHOREOGRAPHY.theme;

export interface MoonController {
  /** The glided anchor: centre and diameter in px, alpha, halo, visible. */
  readonly state: MoonState;
  /** The moon's own day/night blend, 0..1. */
  readonly night: number;
  /** Scroll-dim target (1, or 0.6 past scrollY 400 on a post). */
  readonly dimTarget: number;
  /**
   * Moves to a layout's anchor: a glide when the moon is up (600 ms on a
   * route change, 200 on a same-set resize), the §4.1 fade-in when it is
   * not, the 280 ms fade-out when the layout has none.
   */
  enter(
    layout: RouteLayout,
    ts: number,
    glideMs?: number,
    keepDim?: boolean,
  ): void;
  /** Retargets the blend: a §4.3 tween while the moon is up, a snap otherwise. */
  setNight(target: 0 | 1, ts: number): void;
  /** Scroll dim (§0.16): alpha × `target` over `ms` (0 snaps). */
  setDim(target: number, ts: number, ms: number): void;
  /** Reduced motion: one still frame at the layout's anchor. */
  snap(layout: RouteLayout, night: 0 | 1): void;
  /** Advances every tween to `ts`. */
  update(ts: number): void;
  /**
   * True when the straight glide from the current centre to `to` (inflated
   * by the disc radius) crosses any of `bodies` (each inflated upward by
   * `risePx`, the exit rise): the glide must then wait for the exit (§8:
   * bodies never cross the moon disc).
   */
  glideCrosses(
    to: Vec2,
    diameter: number,
    bodies: readonly Rect[],
    risePx: number,
  ): boolean;
}

export function createMoonController(): MoonController {
  const state: MoonState = {
    centre: { x: 0, y: 0 },
    diameter: 0,
    alpha: 0,
    haloAlpha: 0,
    visible: false,
  };
  let x: Tween | null = null;
  let y: Tween | null = null;
  let d: Tween | null = null;
  let alpha: Tween | null = null;
  let halo: Tween | null = null;
  let dim: Tween | null = null;
  let dimTarget = 1;
  let wanted = false;
  let night = 1;
  let nightTween: Tween | null = null;

  const up = () => state.visible && state.alpha > 0.01;

  return {
    state,
    get night() {
      return night;
    },
    get dimTarget() {
      return dimTarget;
    },

    enter(layout, ts, glideMs = ROUTE.moonGlideMs, keepDim = false) {
      const anchor = layout.moon;

      wanted = anchor !== null;
      if (anchor) {
        if (up()) {
          // §4.2: the moon is shared; it glides to the new anchor.
          x = tween(state.centre.x, anchor.centre.x, ts, glideMs);
          y = tween(state.centre.y, anchor.centre.y, ts, glideMs);
          d = tween(state.diameter, anchor.diameter, ts, glideMs);
          alpha = tween(tweenAt(alpha, ts, state.alpha), 1, ts, glideMs);
          halo = tween(
            state.haloAlpha,
            lightRules.moon.halo.peakDark,
            ts,
            glideMs,
          );
        } else {
          x = y = d = null;
          state.centre.x = anchor.centre.x;
          state.centre.y = anchor.centre.y;
          state.diameter = anchor.diameter;
          alpha = tween(0, 1, ts, MOUNT.moonFadeMs);
          halo = tween(
            0,
            lightRules.moon.halo.peakDark,
            ts + MOUNT.moonHaloDelayMs / 1000,
            MOUNT.moonHaloMs,
          );
        }
        state.visible = true;
      } else if (state.visible) {
        alpha = tween(state.alpha, 0, ts, ROUTE.moonFadeMs);
        halo = tween(state.haloAlpha, 0, ts, ROUTE.moonFadeMs);
      }
      if (!keepDim) {
        dim = null;
        dimTarget = 1;
      }
    },

    setNight(target, ts) {
      if (!up()) {
        // Arriving fresh (or gone): no disc to blend, the value just follows.
        night = target;
        nightTween = null;

        return;
      }
      if (nightTween ? nightTween.to === target : night === target) return;
      nightTween = tween(
        night,
        target,
        ts,
        target === 1 ? THEME.moonMs : THEME.moonOutMs,
      );
    },

    setDim(target, ts, ms) {
      if (target === dimTarget) return;
      dimTarget = target;
      dim = tween(tweenAt(dim, ts, 1), target, ts, ms);
    },

    snap(layout, nightTarget) {
      x = y = d = alpha = halo = dim = nightTween = null;
      dimTarget = 1;
      night = nightTarget;
      if (layout.moon) {
        state.centre.x = layout.moon.centre.x;
        state.centre.y = layout.moon.centre.y;
        state.diameter = layout.moon.diameter;
        state.alpha = 1;
        state.haloAlpha = lightRules.moon.halo.peakDark;
        state.visible = true;
        wanted = true;
      } else {
        state.visible = false;
        state.alpha = 0;
        wanted = false;
      }
    },

    update(ts) {
      night = tweenAt(nightTween, ts, night);
      if (tweenDone(nightTween, ts)) nightTween = null;

      if (state.visible) {
        state.centre.x = tweenAt(x, ts, state.centre.x);
        state.centre.y = tweenAt(y, ts, state.centre.y);
        state.diameter = tweenAt(d, ts, state.diameter);
        state.alpha =
          tweenAt(alpha, ts, state.alpha) * tweenAt(dim, ts, dimTarget);
        state.haloAlpha = tweenAt(halo, ts, state.haloAlpha);
        if (!wanted && state.alpha <= 0.001) state.visible = false;
      }
    },

    glideCrosses(to, diameter, bodies, risePx) {
      if (!up()) return false;

      const r = diameter / 2 + 8;
      const from = state.centre;

      for (const body of bodies) {
        const box = {
          x: body.x - r,
          y: body.y - risePx - r,
          w: body.w + 2 * r,
          h: body.h + risePx + 2 * r,
        };

        for (let i = 0; i <= 16; i += 1) {
          const t = i / 16;
          const px = from.x + (to.x - from.x) * t;
          const py = from.y + (to.y - from.y) * t;

          if (
            px >= box.x &&
            px <= box.x + box.w &&
            py >= box.y &&
            py <= box.y + box.h
          )
            return true;
        }
      }

      return false;
    },
  };
}
