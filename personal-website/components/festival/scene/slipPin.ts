/**
 * The riddle slip's pin (bible §6.A3): each frame the strip hangs from
 * lantern B's bottom-collar world point, `damp` λ 12, and leans 0.8× the
 * body's θ. The gap between the collar and the strip's top comes from the
 * layout (the strip rect sits `SLIP_GAP_PX` under the paper), so the strip
 * lands exactly where the resolver placed it when the lantern hangs plumb.
 * DOM-free; the canvas writes the result into the CSS custom properties.
 */

import { slipPin, type SlipPin } from './projectPx.ts';
import type {
  LanternId,
  LanternSpec,
  LanternState,
  RouteLayout,
  Viewport,
  WorldPoint,
} from './types.ts';

/** Slip pin damping λ (§6.A3). */
export const SLIP_DAMP_LAMBDA = 12;

/**
 * The strip's rest offset from the bottom-collar point, px: the strip rect's
 * top minus the collar's y at θ = 0 (body centre less the collar's local y,
 * `collarPointY` in body-height units from lantern.ts).
 */
export function slipGapFor(layout: RouteLayout, collarPointY: number): number {
  const spec = layout.lanterns.find((l) => l.slip && l.slipRect);

  if (!spec || !spec.slipRect) return 0;

  const restCollarY =
    spec.bodyRect.y + spec.bodyRect.h / 2 - collarPointY * spec.body;

  return spec.slipRect.y - restCollarY;
}

export interface SlipPinner {
  /** Re-reads which lantern carries the slip and its gap; the damping restarts. */
  setLayout(layout: RouteLayout): void;
  /**
   * The strip's pin for this frame (centre x, top y, lean in degrees), or
   * null when the layout hangs no slip. `snap` skips the damping (reduced
   * motion, or the first frame after a layout).
   */
  step(
    states: readonly LanternState[],
    collarPoint: (id: LanternId, out: WorldPoint) => WorldPoint,
    viewport: Viewport,
    dt: number,
    snap: boolean,
  ): SlipPin | null;
}

export function createSlipPinner(collarPointY: number): SlipPinner {
  const collar: WorldPoint = { x: 0, y: 0, z: 0 };
  const pin: SlipPin = { x: 0, y: 0, thetaDeg: 0 };
  const live = { x: NaN, y: NaN };
  const out: SlipPin = { x: 0, y: 0, thetaDeg: 0 };
  let gapPx = 0;
  let spec: LanternSpec | null = null;

  return {
    setLayout(layout) {
      gapPx = slipGapFor(layout, collarPointY);
      spec = layout.lanterns.find((l) => l.slip) ?? null;
      live.x = NaN;
    },

    step(states, collarPoint, viewport, dt, snap) {
      if (!spec) return null;

      let state: LanternState | undefined;

      for (const l of states) if (l.id === spec.id) state = l;
      if (!state) return null;

      collarPoint(spec.id, collar);
      slipPin(collar, state, viewport, pin);

      const targetY = pin.y + gapPx;

      if (Number.isNaN(live.x) || snap) {
        live.x = pin.x;
        live.y = targetY;
      } else {
        const k = 1 - Math.exp(-SLIP_DAMP_LAMBDA * dt);

        live.x += (pin.x - live.x) * k;
        live.y += (targetY - live.y) * k;
      }
      out.x = live.x;
      out.y = live.y;
      out.thetaDeg = pin.thetaDeg;

      return out;
    },
  };
}
