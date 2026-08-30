'use client';

import { useSyncExternalStore } from 'react';
import { damp } from '../shared/runtime';
import {
  clampEraIndex,
  eraPalettes,
  nearestEraIndex,
  type EraPalette,
} from './museumData';

type MuseumState = {
  current: number;
  target: number;
  reducedMotion: boolean;
};

const state: MuseumState = {
  current: eraPalettes.length - 1,
  target: eraPalettes.length - 1,
  reducedMotion: false,
};

const listeners = new Set<() => void>();
const roots = new Set<HTMLElement>();
const rootObservers = new Map<HTMLElement, ResizeObserver>();
let frame = 0;
let previousTime = 0;
let selectedIndex = nearestEraIndex(state.target);

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function mixHex(from: string, to: string, amount: number) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * amount);

  return `#${[
    channel(start.r, end.r),
    channel(start.g, end.g),
    channel(start.b, end.b),
  ]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function interpolatePalette(position: number): EraPalette {
  const leftIndex = Math.floor(position);
  const rightIndex = Math.ceil(position);
  const amount = position - leftIndex;
  const left = eraPalettes[leftIndex];
  const right = eraPalettes[rightIndex];

  return {
    commit: amount < 0.5 ? left.commit : right.commit,
    wall: mixHex(left.wall, right.wall, amount),
    ink: mixHex(left.ink, right.ink, amount),
    accent: mixHex(left.accent, right.accent, amount),
    miniature: mixHex(left.miniature, right.miniature, amount),
  };
}

function paintRoot(root: HTMLElement) {
  const palette = interpolatePalette(state.current);
  root.style.setProperty('--museum-wall', palette.wall);
  root.style.setProperty('--museum-ink', palette.ink);
  root.style.setProperty('--museum-accent', palette.accent);
  root.style.setProperty('--museum-miniature', palette.miniature);
  root.style.setProperty('--museum-position', state.current.toFixed(4));

  for (const exhibit of root.querySelectorAll<HTMLElement>(
    '[data-era-index]',
  )) {
    const eraIndex = Number(exhibit.dataset.eraIndex);
    const distance = eraIndex - state.current;
    const absoluteDistance = Math.abs(distance);
    const scale = Math.max(0.46, 1 - absoluteDistance * 0.36);
    const opacity = Math.max(0.14, 1 - absoluteDistance * 0.55);
    exhibit.style.setProperty('--gallery-x', `${distance * 42}vw`);
    exhibit.style.setProperty('--gallery-scale', scale.toFixed(4));
    exhibit.style.setProperty('--gallery-opacity', opacity.toFixed(4));
    exhibit.style.setProperty(
      '--gallery-z',
      String(100 - Math.round(absoluteDistance * 10)),
    );
  }

  for (const stage of root.querySelectorAll<HTMLElement>(
    '[data-miniature-stage]',
  )) {
    const canvas = stage.parentElement;
    if (canvas) {
      stage.style.setProperty(
        '--miniature-scale',
        (canvas.clientWidth / 960).toFixed(5),
      );
    }
  }
}

function paint() {
  for (const root of roots) {
    paintRoot(root);
  }
}

function stopFrame() {
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  previousTime = 0;
}

function tick(time: number) {
  const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
  previousTime = time;
  state.current = damp(state.current, state.target, 7, delta);

  if (Math.abs(state.target - state.current) < 0.0005) {
    state.current = state.target;
    stopFrame();
    paint();
    return;
  }

  paint();
  frame = requestAnimationFrame(tick);
}

function startFrame() {
  if (!frame && !state.reducedMotion) {
    frame = requestAnimationFrame(tick);
  }
}

function publishSelection() {
  const next = nearestEraIndex(state.target);

  if (next !== selectedIndex) {
    selectedIndex = next;
    for (const listener of listeners) {
      listener();
    }
  }
}

export function setMuseumTarget(value: number) {
  state.target = clampEraIndex(value);
  publishSelection();

  if (state.reducedMotion) {
    state.current = state.target;
    paint();
  } else {
    startFrame();
  }
}

export function setMuseumReducedMotion(reducedMotion: boolean) {
  state.reducedMotion = reducedMotion;

  if (reducedMotion) {
    stopFrame();
    state.current = state.target;
    paint();
  }
}

export function attachMuseumRoot(
  root: HTMLElement | null,
  reducedMotion: boolean,
) {
  setMuseumReducedMotion(reducedMotion);

  if (!root) {
    return;
  }

  roots.add(root);
  paintRoot(root);

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => paintRoot(root));
    observer.observe(root);
    rootObservers.set(root, observer);
  }

  return () => {
    rootObservers.get(root)?.disconnect();
    rootObservers.delete(root);
    roots.delete(root);
  };
}

export function readMuseumTarget() {
  return state.target;
}

export function useMuseumEra() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selectedIndex,
    () => eraPalettes.length - 1,
  );
}
