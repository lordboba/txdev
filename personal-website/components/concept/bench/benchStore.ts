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

  /*
   * Devices and company tags are two selection channels inside the same work
   * view, and each one owns the camera while it is open. Picking a device has
   * to release a tag, or the two shots fight over the lens every frame.
   */
  clearBenchTagSelection();
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
  /* The hang is the whole shot; a tag record cannot stay open behind it. */
  clearBenchTagSelection();
  setBenchTagHover(-1);
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
 * Escape unwinds one level at a time — focused piece, then the gallery, then
 * an open company-tag record. It is bound here rather than in a component so
 * there is exactly one handler no matter how many surfaces subscribe, and so
 * it is torn down with the last of them.
 *
 * One handler for both sub-views, refcounted across their two subscribe
 * functions: two independent listeners would both fire on the same keystroke
 * and there would be no defined order between them.
 */
function handleBenchEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }

  if (gallery.open) {
    if (gallery.piece >= 0) {
      clearBenchGalleryPiece();
      return;
    }

    closeBenchGallery();
    return;
  }

  clearBenchTagSelection();
}

let escapeHolders = 0;

function retainEscape() {
  escapeHolders += 1;

  if (escapeHolders === 1 && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleBenchEscape);
  }
}

function releaseEscape() {
  escapeHolders -= 1;

  if (escapeHolders === 0 && typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleBenchEscape);
  }
}

export function readBenchGallery() {
  return gallery;
}

export function subscribeBenchGallery(listener: () => void) {
  galleryListeners.add(listener);
  retainEscape();

  return () => {
    galleryListeners.delete(listener);
    releaseEscape();
  };
}

/* -------------------------------------------------------------------------- */
/* Company tags                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The five hanging employer tags. Like the gallery this is a sub-view of
 * `work`, not a fifth view: the hash never changes, so browser back still
 * leaves the page rather than unwinding an invented history entry.
 *
 * Hover and selection live in their own channel rather than in the shared
 * `focus` record because the tags are lit by two surfaces at once — the 3D
 * raycast and the DOM rail under the project plates — and both have to agree
 * without either one stealing the device hover slot.
 */
export type BenchTags = {
  hovered: number;
  selected: number;
};

let tags: BenchTags = { hovered: -1, selected: -1 };
const tagListeners = new Set<() => void>();

function commitTags(next: BenchTags) {
  if (tags.hovered === next.hovered && tags.selected === next.selected) {
    return;
  }

  tags = next;
  tagListeners.forEach((listener) => listener());
}

export function setBenchTagHover(index: number) {
  commitTags({ ...tags, hovered: index });
}

export function setBenchTagSelection(index: number) {
  if (gallery.open) {
    return;
  }

  /* The tag shot owns the lens, so a device selection has to stand down. */
  focus.selected = -1;
  commitTags({ ...tags, selected: index });
}

export function clearBenchTagSelection() {
  commitTags({ ...tags, selected: -1 });
}

export function readBenchTags() {
  return tags;
}

export function subscribeBenchTags(listener: () => void) {
  tagListeners.add(listener);
  retainEscape();

  return () => {
    tagListeners.delete(listener);
    releaseEscape();
  };
}

export function readBenchFocus(view: ConceptViewId) {
  if (focus.view !== view) {
    return { hovered: -1, selected: -1 };
  }

  return { hovered: focus.hovered, selected: focus.selected };
}
