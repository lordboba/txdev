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

export function readBenchFocus(view: ConceptViewId) {
  if (focus.view !== view) {
    return { hovered: -1, selected: -1 };
  }

  return { hovered: focus.hovered, selected: focus.selected };
}
