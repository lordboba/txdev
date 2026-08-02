'use client';

import type { ConceptViewId } from '../conceptData';

type Focus = {
  view: ConceptViewId;
  hovered: number;
  selected: number;
};

const focus: Focus = {
  view: 'work',
  hovered: -1,
  selected: -1,
};

const pointer = { x: 0, y: 0 };

export function setBenchPointer(x: number, y: number) {
  pointer.x = x;
  pointer.y = y;
}

export function readBenchPointer() {
  return pointer;
}

function enterFocusView(view: ConceptViewId) {
  if (focus.view === view) {
    return;
  }

  focus.view = view;
  focus.hovered = -1;
  focus.selected = -1;
}

export function setBenchHover(view: ConceptViewId, index: number) {
  enterFocusView(view);
  focus.hovered = index;
}

export function setBenchSelection(view: ConceptViewId, index: number) {
  enterFocusView(view);
  focus.selected = index;
}

export function clearBenchSelection() {
  focus.selected = -1;
}

/**
 * Whether every damped transform (and the camera) has landed on its target.
 * The ground-shadow pass subscribes to this so its depth render can be gated
 * off once the scene stops moving — it is the single largest avoidable
 * per-frame cost in the bench.
 */
let settled = false;
const settledListeners = new Set<() => void>();

export function setBenchSettled(next: boolean) {
  if (settled === next) {
    return;
  }

  settled = next;
  settledListeners.forEach((listener) => listener());
}

export function readBenchSettled() {
  return settled;
}

export function subscribeBenchSettled(listener: () => void) {
  settledListeners.add(listener);

  return () => {
    settledListeners.delete(listener);
  };
}

export function readBenchFocus(view: ConceptViewId) {
  if (focus.view !== view) {
    return { hovered: -1, selected: -1 };
  }

  return { hovered: focus.hovered, selected: focus.selected };
}
