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

/** Value formatting per custom property: px unless it is an angle or a ratio. */
function formatVar(name: PinVarName, value: number): string {
  if (name === 'night') return value.toFixed(3);
  if (name === 'slipTheta' || name === 'poemTheta')
    return `${value.toFixed(2)}deg`;

  return `${Math.round(value * 100) / 100}px`;
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
