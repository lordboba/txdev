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

/* -------------------------------------------------------------------------- */
/* Side-projects gallery                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The gallery is a sub-view of `work`, not a fifth view: the hash never
 * changes, so browser back always leaves the page rather than unwinding an
 * invented history entry the user never asked for.
 *
 * `open` is what the camera and the DOM read. `mounted` is a separate,
 * later-falling flag the renderer owns: the hang's textures are only ever
 * mounted while it is true, and the scene drops it once the exit transit has
 * landed, so closing the gallery still gets an animated exit and an idle work
 * shot still pays nothing for eight framed screenshots.
 */
export type BenchGallery = {
  open: boolean;
  mounted: boolean;
  piece: number;
};

let gallery: BenchGallery = { open: false, mounted: false, piece: -1 };
const galleryListeners = new Set<() => void>();

function commitGallery(next: BenchGallery) {
  if (
    gallery.open === next.open &&
    gallery.mounted === next.mounted &&
    gallery.piece === next.piece
  ) {
    return;
  }

  gallery = next;
  galleryListeners.forEach((listener) => listener());
}

export function openBenchGallery() {
  commitGallery({ open: true, mounted: true, piece: -1 });
}

export function closeBenchGallery() {
  if (!gallery.open) {
    return;
  }

  commitGallery({ ...gallery, open: false, piece: -1 });
}

/** Renderer-only: drop the hang once its exit transit has finished. */
export function releaseBenchGallery() {
  if (gallery.open || !gallery.mounted) {
    return;
  }

  commitGallery({ ...gallery, mounted: false });
}

export function setBenchGalleryPiece(index: number) {
  if (!gallery.open) {
    return;
  }

  commitGallery({ ...gallery, piece: index });
}

export function clearBenchGalleryPiece() {
  if (!gallery.open || gallery.piece < 0) {
    return;
  }

  commitGallery({ ...gallery, piece: -1 });
}

/**
 * Escape unwinds one level at a time — focused piece, then the gallery itself.
 * It is bound here rather than in a component so there is exactly one handler
 * no matter how many surfaces subscribe, and so it is torn down with the last
 * of them.
 */
function handleGalleryKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !gallery.open) {
    return;
  }

  if (gallery.piece >= 0) {
    clearBenchGalleryPiece();
    return;
  }

  closeBenchGallery();
}

export function readBenchGallery() {
  return gallery;
}

export function subscribeBenchGallery(listener: () => void) {
  galleryListeners.add(listener);

  if (galleryListeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGalleryKey);
  }

  return () => {
    galleryListeners.delete(listener);

    if (galleryListeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleGalleryKey);
    }
  };
}

export function readBenchFocus(view: ConceptViewId) {
  if (focus.view !== view) {
    return { hovered: -1, selected: -1 };
  }

  return { hovered: focus.hovered, selected: focus.selected };
}
