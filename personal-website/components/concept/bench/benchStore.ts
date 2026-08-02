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
 * Picking the object that is already picked puts it back.
 *
 * The raycast path uses this rather than `setBenchSelection`, because a device
 * on the bench is a thing you look closer at, and looking closer has to have
 * an obvious way back that is the same gesture. The DOM plates keep the plain
 * setter: they are anchors that navigate, so a second press there is a visit,
 * not an undo.
 */
export function toggleBenchSelection(view: ConceptViewId, index: number) {
  if (focus.view === view && focus.selected === index) {
    clearBenchSelection();
    return;
  }

  setBenchSelection(view, index);
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

  /*
   * Published to the document as well as to the subscribers, because one of
   * the consumers is not a React tree: scripts/update-history.mjs photographs
   * the running site for the history shelf, and a fixed sleep is not a settle
   * test. On software GL a fourteen-second budget caught the bench mid-intro
   * and the committed artifact showed the laptops hovering off the surface
   * with no shadows under them — a permanent record of an unfinished frame.
   * This is the same flag the shadow pass gates on, in a form a CDP probe can
   * read.
   */
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.benchSettled = next ? 'true' : 'false';
  }

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
 * an open company-tag record, then an opened era capture, then the era record
 * behind it, then an open signal. It is bound here rather
 * than in a component so there is exactly one handler no matter how many
 * surfaces subscribe, and so it is torn down with the last of them.
 *
 * One handler for every sub-view, refcounted across their subscribe functions:
 * independent listeners would all fire on the same keystroke and there would
 * be no defined order between them.
 *
 * The tag and signal branches cannot both be live — tags belong to `work` and
 * signals to `signals`, and leaving a view clears the other's record — so the
 * order between those two is a formality rather than a precedence.
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

  if (tags.selected >= 0) {
    clearBenchTagSelection();
    return;
  }

  if (history.lightbox) {
    closeBenchHistoryLightbox();
    return;
  }

  if (history.selected >= 0) {
    clearBenchHistorySelection();
    return;
  }

  clearBenchSignalSelection();

  /*
   * Last rung: the device selection inside `work`.
   *
   * It was missing, and it was the one sub-state on the page that Escape did
   * not unwind. Clicking a screen leans the work lens in and drops its fov,
   * and the only way back out was a click on empty bench — undiscoverable, and
   * with no DOM affordance offering it. Every other sub-state exits on Escape;
   * this restores the resting pose on the same key rather than leaving the
   * default composition quietly destroyed.
   */
  clearBenchSelection();
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

/* -------------------------------------------------------------------------- */
/* Signals                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The three experiment blanks. Their own channel rather than the shared
 * `focus` record for the same reason the tags have one: both the raycast and
 * the DOM plate under it drive the same state, and the DOM has to *re-render*
 * when a blank is clicked — `focus` is read once per frame by the renderer and
 * notifies nobody.
 *
 * An open signal is a sub-view of `signals`, not a fifth view: the hash never
 * changes, so browser back still leaves the page rather than unwinding an
 * invented history entry.
 */
export type BenchSignals = {
  hovered: number;
  selected: number;
};

let signals: BenchSignals = { hovered: -1, selected: -1 };
const signalListeners = new Set<() => void>();

function commitSignals(next: BenchSignals) {
  if (signals.hovered === next.hovered && signals.selected === next.selected) {
    return;
  }

  signals = next;
  signalListeners.forEach((listener) => listener());
}

export function setBenchSignalHover(index: number) {
  commitSignals({ ...signals, hovered: index });
}

export function setBenchSignalSelection(index: number) {
  commitSignals({ ...signals, selected: index });
}

export function clearBenchSignalSelection() {
  commitSignals({ ...signals, selected: -1 });
}

export function readBenchSignals() {
  return signals;
}

export function subscribeBenchSignals(listener: () => void) {
  signalListeners.add(listener);
  retainEscape();

  return () => {
    signalListeners.delete(listener);
    releaseEscape();
  };
}

/* -------------------------------------------------------------------------- */
/* History                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The era run. Its own channel for the same reason the signals have one: the
 * DOM has to re-render when a card is picked, and `focus` is read once per
 * frame by the renderer and notifies nobody.
 *
 * Selection is still mirrored into `focus` so the scene's per-frame layout
 * keeps a single place to ask which card is the hero — this channel is the
 * writer, `focus` is the renderer's read model, and nothing else writes to the
 * history slot of `focus`.
 *
 * `lightbox` is one level deeper again: the record panel prints the capture at
 * band height, and the lightbox is the same capture at full size over the
 * page. Both are sub-views of `history`, so neither touches the hash and
 * browser back still leaves the page.
 */
export type BenchHistory = {
  selected: number;
  lightbox: boolean;
  /**
   * Sticky. The era captures are seven full-frame PNGs, and an idle work shot
   * must not pay for them — but once they are in the scene they stay, because
   * dropping them on exit would blank the cards mid-transit. Set the first time
   * the run is asked for, by the nav gesture or by the frame loop, and never
   * cleared for the life of the page.
   */
  live: boolean;
};

let history: BenchHistory = { selected: -1, lightbox: false, live: false };
const historyListeners = new Set<() => void>();

function commitHistory(next: BenchHistory) {
  if (
    history.selected === next.selected &&
    history.lightbox === next.lightbox &&
    history.live === next.live
  ) {
    return;
  }

  history = next;
  historyListeners.forEach((listener) => listener());
}

export function markBenchHistoryLive() {
  commitHistory({ ...history, live: true });
}

export function setBenchHistorySelection(index: number) {
  setBenchSelection('history', index);
  /* Picking a different era closes the capture opened over the last one. */
  commitHistory({ ...history, selected: index, lightbox: false });
}

export function clearBenchHistorySelection() {
  if (focus.view === 'history') {
    focus.selected = -1;
  }

  commitHistory({ ...history, selected: -1, lightbox: false });
}

export function openBenchHistoryLightbox() {
  if (history.selected < 0) {
    return;
  }

  commitHistory({ ...history, lightbox: true });
}

export function closeBenchHistoryLightbox() {
  commitHistory({ ...history, lightbox: false });
}

export function readBenchHistory() {
  return history;
}

export function subscribeBenchHistory(listener: () => void) {
  historyListeners.add(listener);
  retainEscape();

  return () => {
    historyListeners.delete(listener);
    releaseEscape();
  };
}

export function readBenchFocus(view: ConceptViewId) {
  if (focus.view !== view) {
    return { hovered: -1, selected: -1 };
  }

  return { hovered: focus.hovered, selected: focus.selected };
}
