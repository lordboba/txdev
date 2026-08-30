'use client';

import { gitEras, type ConceptViewId } from '../conceptData';

/**
 * Frame-level state shared between the DOM chrome and the WebGL armature.
 * These values change up to sixty times a second, so they live outside React
 * entirely — the rails read them in an animation frame, the scene writes them.
 */
const state = {
  focusView: 'profile' as ConceptViewId,
  focusIndex: -1,
  azimuth: 0,
  elevation: 0,
  scroll: 0,
  pointerX: 0,
  pointerY: 0,
};

/** Focus is scoped to the view that set it, so a stale hover cannot light the
 *  wrong ring after a transit. */
export function setArmatureFocus(view: ConceptViewId, index: number) {
  state.focusView = view;
  state.focusIndex = index;
}

export function focusForView(view: ConceptViewId) {
  if (state.focusView === view) {
    return state.focusIndex;
  }

  // History opens on its most recent era; nothing else starts focused.
  return view === 'history' ? gitEras.length - 1 : -1;
}

export function setTelemetry(azimuth: number, elevation: number) {
  state.azimuth = azimuth;
  state.elevation = elevation;
}

export function readAzimuth() {
  return state.azimuth;
}

export function readElevation() {
  return state.elevation;
}

export function setScrollProgress(progress: number) {
  state.scroll = progress;
}

export function readScrollProgress() {
  return state.scroll;
}

export function setPointer(x: number, y: number) {
  state.pointerX = x;
  state.pointerY = y;
}

export function readPointerX() {
  return state.pointerX;
}

export function readPointerY() {
  return state.pointerY;
}
