'use client';

import { conceptViews, type ConceptViewId } from '../conceptData';
import { damp } from '../shared/runtime';

const QUARTER = Math.PI / 2;

export const FACE_ORDER: ConceptViewId[] = conceptViews.map((view) => view.id);

/** Face index the camera is currently looking at, derived from the angle. */
export function faceFromAngle(angle: number) {
  return ((Math.round(-angle / QUARTER) % 4) + 4) % 4;
}

/** Nearest angle equivalent to `face`, so settling never unwinds a full turn. */
export function angleForFace(face: number, from: number) {
  const base = -face * QUARTER;
  const turns = Math.round((from - base) / (Math.PI * 2));

  return base + turns * Math.PI * 2;
}

/**
 * The monolith's physics live here rather than in the component: the object
 * is a hand-driven control, and its angle, momentum and settle behaviour are
 * simulation state that React should never re-render for.
 */
const state = {
  angle: 0,
  targetAngle: 0,
  spin: 0,
  mode: 'settle' as 'drag' | 'inertia' | 'settle',
  view: FACE_ORDER[0],
  hover: -1,
};

export function setHover(index: number) {
  state.hover = index;
}

export function readHover() {
  return state.hover;
}

export function beginDrag() {
  state.mode = 'drag';
  state.spin = 0;
}

export function dragBy(deltaAngle: number, deltaSeconds: number) {
  state.angle += deltaAngle;
  state.spin = deltaAngle / deltaSeconds;
}

/**
 * A flick keeps turning under its own momentum; a slow release settles onto
 * the nearest face immediately and returns it so the view can follow.
 */
export function endDrag(): number | null {
  if (Math.abs(state.spin) > 0.8) {
    state.mode = 'inertia';
    return null;
  }

  state.mode = 'settle';
  const face = faceFromAngle(state.angle);
  state.targetAngle = angleForFace(face, state.angle);

  return face;
}

export type MonolithStep = {
  angle: number;
  /** Face to commit to the view store this frame, if any. */
  commit: number | null;
};

/**
 * Advances one frame. Also reconciles external view changes — a nav button,
 * an arrow key, or the comparison board — unless a hand is on the object.
 */
export function advanceMonolith(
  delta: number,
  view: ConceptViewId,
  reducedMotion: boolean,
): MonolithStep {
  let commit: number | null = null;

  if (state.view !== view) {
    state.view = view;

    if (state.mode !== 'drag') {
      state.mode = 'settle';
      state.targetAngle = angleForFace(FACE_ORDER.indexOf(view), state.angle);
    }
  }

  if (state.mode === 'inertia') {
    state.angle += state.spin * delta;
    // Heavy, physical decay — the object should feel like it has mass.
    state.spin *= Math.exp(-2.3 * delta);

    if (Math.abs(state.spin) < 0.4) {
      state.mode = 'settle';
      commit = faceFromAngle(state.angle);
      state.targetAngle = angleForFace(commit, state.angle);
    }
  } else if (state.mode === 'settle') {
    state.angle = damp(
      state.angle,
      state.targetAngle,
      reducedMotion ? 60 : 3.4,
      delta,
    );
  }

  return { angle: state.angle, commit };
}
