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
import { smoothstep } from './noise.ts';
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
/** The disc keeps this far outside a nav band it would cross (§4.2). */
const NAV_MARGIN_PX = 6;
/** Horizontal overlap over which the push out of the nav band eases in. */
const NAV_EASE_PX = 24;

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
  /**
   * The nav band the disc must stay out of (§4.2: the inset nav on
   * `/past-experience` paints over the layer and bit a corner off the moon
   * mid-glide). `enter()` takes it from the layout; the canvas may hand the
   * next route's band earlier, on the commit. Null clears it.
   */
  avoid(rect: Rect | null): void;
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
  let avoid: Rect | null = null;

  const up = () => state.visible && state.alpha > 0.01;

  /**
   * Pushes the disc down out of `avoid` by the amount it overlaps the band
   * horizontally (eased over 24 px), so a glide that crosses the band ducks
   * under it and rises again without a step, and an anchor clear of the
   * band (every resolved anchor is) is left exactly where the tween put it.
   */
  const keepOutOfNav = (): void => {
    if (!avoid) return;

    // Horizontal overlap measured with the ease band added to the disc: the
    // push is complete once the limb is within the 6 px margin of the band.
    const r = state.diameter / 2;
    const left = state.centre.x - r - NAV_EASE_PX;
    const right = state.centre.x + r + NAV_EASE_PX;
    const overlapX = Math.min(right - avoid.x, avoid.x + avoid.w - left);

    if (overlapX <= 0) return;

    const floor = avoid.y + avoid.h + NAV_MARGIN_PX + r;

    if (state.centre.y >= floor) return;

    const w = smoothstep(0, NAV_EASE_PX - NAV_MARGIN_PX, overlapX);

    state.centre.y += (floor - state.centre.y) * w;
  };

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

      avoid = layout.navBand;
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

    avoid(rect) {
      avoid = rect;
    },

    snap(layout, nightTarget) {
      x = y = d = alpha = halo = dim = nightTween = null;
      dimTarget = 1;
      night = nightTarget;
      avoid = layout.navBand;
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
        keepOutOfNav();
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
