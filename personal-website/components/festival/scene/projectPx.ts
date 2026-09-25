/**
 * World → CSS px for the HTML overlay (bible §2.2 "positioned from the sim
 * once per frame through CSS custom properties"). The analytic projection
 * (`worldToPx`) matches the §7.3 camera exactly; `projectWithCamera` is the
 * same thing through three's matrices for the gauntlet to cross-check.
 */

import type { Camera, Vector3 } from 'three';

import { worldToPx } from './layout.ts';
import {
  FESTIVAL_CSS_VARS,
  PENDULUM,
  type LanternState,
  type Vec2,
  type Viewport,
  type WorldPoint,
} from './types.ts';

export const RAD_TO_DEG = 180 / Math.PI;

/** World point → CSS px (top-left origin), using the §7.3 camera model. */
export function projectPx(
  point: WorldPoint,
  viewport: Viewport,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  return worldToPx(point, viewport, out);
}

/**
 * The same projection through a live three camera (NDC → px). `scratch` is
 * a caller-owned `Vector3` so nothing allocates per frame.
 */
export function projectWithCamera(
  camera: Camera,
  point: WorldPoint,
  viewport: Viewport,
  scratch: Vector3,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  scratch.set(point.x, point.y, point.z).project(camera);
  out.x = (scratch.x + 1) * 0.5 * viewport.w;
  out.y = (1 - scratch.y) * 0.5 * viewport.h;

  return out;
}

/** What the riddle slip needs each frame: its pin in px and its lean in deg. */
export interface SlipPin {
  x: number;
  y: number;
  thetaDeg: number;
}

/**
 * Slip pin from lantern B's bottom-collar world point (`LanternObjects
 * .collarPoint`) and its state: 0.8× the body's θ, in degrees.
 */
export function slipPin(
  collar: WorldPoint,
  state: Pick<LanternState, 'theta'>,
  viewport: Viewport,
  out: SlipPin = { x: 0, y: 0, thetaDeg: 0 },
): SlipPin {
  worldToPx(collar, viewport, out);
  out.thetaDeg = state.theta * PENDULUM.slipThetaScale * RAD_TO_DEG;

  return out;
}

export type PinVarName = keyof typeof FESTIVAL_CSS_VARS;

/**
 * Value formatting per custom property: px unless it is an angle or a ratio.
 * Quantised (0.05 px / 0.05° / 0.005) so a settled object formats to the
 * same string frame after frame and the writer below can skip it.
 */
function formatVar(name: PinVarName, value: number): string {
  if (name === 'night') return (Math.round(value * 200) / 200).toFixed(3);
  if (name === 'slipTheta' || name === 'poemTheta')
    return `${(Math.round(value * 20) / 20).toFixed(2)}deg`;

  return `${Math.round(value * 20) / 20}px`;
}

/**
 * Writes the overlay's custom properties in one pass. Only the names passed
 * are touched; `null` removes a property.
 */
export function writePinVars(
  root: HTMLElement,
  values: Partial<Record<PinVarName, number | null>>,
): void {
  for (const key of Object.keys(values) as PinVarName[]) {
    const value = values[key];
    const property = FESTIVAL_CSS_VARS[key];

    if (value === null || value === undefined) {
      root.style.removeProperty(property);
    } else {
      root.style.setProperty(property, formatVar(key, value));
    }
  }
}

export type PinValues = Record<PinVarName, number | null>;

/**
 * A per-frame writer that remembers the last string it wrote for every
 * property and touches `root.style` only when a value changes, so a settled
 * slip and a static moon cost the overlay no style invalidation. The caller
 * mutates the returned `values` object in place and calls `write()`.
 */
export function createPinWriter(root: HTMLElement): {
  values: PinValues;
  write(): void;
} {
  const names = Object.keys(FESTIVAL_CSS_VARS) as PinVarName[];
  const values = Object.fromEntries(
    names.map((name) => [name, null]),
  ) as PinValues;
  // Starts as "nothing written": a name the caller never sets stays untouched
  // (the text rects are written once per layout by `writePinVars`).
  const written: Record<PinVarName, string | null> = Object.fromEntries(
    names.map((name) => [name, null]),
  ) as Record<PinVarName, string | null>;

  return {
    values,
    write() {
      for (const name of names) {
        const value = values[name];
        const next = value === null ? null : formatVar(name, value);

        if (written[name] === next) continue;
        written[name] = next;
        if (next === null) root.style.removeProperty(FESTIVAL_CSS_VARS[name]);
        else root.style.setProperty(FESTIVAL_CSS_VARS[name], next);
      }
    },
  };
}
