'use client';

import {
  consumeJourneyFocus,
  resetJourney,
} from '../../journey/journeyStore.ts';
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
let renderInvalidator: (() => void) | null = null;

function requestBenchRender() {
  renderInvalidator?.();
}

/** Connect store mutations to the mounted demand-driven Canvas. */
export function setBenchRenderInvalidator(invalidate: (() => void) | null) {
  renderInvalidator = invalidate;
}

export function setBenchPointer(x: number, y: number) {
  if (pointer.x === x && pointer.y === y) {
    return;
  }

  pointer.x = x;
  pointer.y = y;

  /*
   * While the journey overlay owns the viewport the scene is fully occluded,
   * so a pointer-rate stream of invalidates would render hidden frames for
   * the whole play session. The coords are still recorded above, so parallax
   * resumes seamlessly on close; during the entry flight (open, not yet
   * revealed) the frame loop is already self-invalidating, and the exit
   * flight runs after `open` drops, so nothing visible loses liveness.
   */
  if (journey.open) {
    return;
  }

  requestBenchRender();
}

export function readBenchPointer() {
  return pointer;
}

function enterFocusView(view: ConceptViewId) {
  if (focus.view === view) {
    return false;
  }

  focus.view = view;
  focus.hovered = -1;
  focus.selected = -1;
  return true;
}

export function setBenchHover(view: ConceptViewId, index: number) {
  const changedView = enterFocusView(view);

  if (!changedView && focus.hovered === index) {
    return;
  }

  focus.hovered = index;
  requestBenchRender();
}

export function setBenchSelection(view: ConceptViewId, index: number) {
  const changedView = enterFocusView(view);
  const changedSelection = focus.selected !== index;
  focus.selected = index;

  if (changedView || changedSelection) {
    requestBenchRender();
  }

  /*
   * Devices and company tags are two selection channels inside the same work
   * view, and each one owns the camera while it is open. Picking a device has
   * to release a tag, or the two shots fight over the lens every frame.
   */
  clearBenchTagSelection();
}

export function clearBenchSelection() {
  if (focus.selected < 0) {
    return;
  }

  focus.selected = -1;
  requestBenchRender();
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

type BenchMotionSource = 'scene' | 'tags' | 'gallery';

/** Whether every independent motion loop has landed on its target. */
const settledBySource: Record<BenchMotionSource, boolean> = {
  scene: false,
  tags: true,
  gallery: true,
};
let settled = false;
const settledListeners = new Set<() => void>();

export function setBenchSettled(source: BenchMotionSource, next: boolean) {
  if (settledBySource[source] === next) {
    return;
  }

  settledBySource[source] = next;
  const nextSettled = Object.values(settledBySource).every(Boolean);

  if (settled === nextSettled) {
    return;
  }

  settled = nextSettled;

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
    document.documentElement.dataset.benchSettled = settled ? 'true' : 'false';
  }

  settledListeners.forEach((listener) => listener());
}

/** Clear module-level motion state when a scene mounts or unmounts. */
export function resetBenchSettlement() {
  settledBySource.scene = false;
  settledBySource.tags = true;
  settledBySource.gallery = true;

  if (!settled) {
    return;
  }

  settled = false;

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.benchSettled = 'false';
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
  requestBenchRender();
}

export function openBenchGallery() {
  if (gallery.open) {
    return;
  }

  /*
   * The journey's camera exclusion, mirrored: openBenchJourney stands the
   * gallery down, and an engaged journey (open, or still flying out while
   * `mounted`) must refuse the gallery right back. During the ~1s entry or
   * exit flight the canvas is still exposed and the tablet — and its DOM
   * twin — is still clickable; a gallery opened under the overlay would
   * wedge benchSettled false and hand the exit flight the gallery shot
   * instead of the bench. Guarded here rather than at the 3D handler so the
   * DOM twins hit the same wall.
   */
  if (journey.open || journey.mounted) {
    return;
  }

  /* The hang is the whole shot; a tag record cannot stay open behind it. */
  clearBenchTagSelection();
  setBenchTagHover(-1);
  /* Publish motion before the texture-loading Suspense boundary can mount. */
  setBenchSettled('gallery', false);
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

/* -------------------------------------------------------------------------- */
/* Journey overlay                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The Personal Env screen's game, rendered as a DOM overlay over the scene.
 * Same open/mounted split as the gallery: `open` is what the DOM overlay and
 * the escape ladder read, and `mounted` is the later-falling flag the renderer
 * owns, so the screen portal can still animate out after `open` drops. Nothing
 * drops it yet — the scene's exit transit takes ownership with the camera
 * slice, through `releaseBenchJourney`.
 */
export type BenchJourney = {
  open: boolean;
  mounted: boolean;
};

let journey: BenchJourney = { open: false, mounted: false };
const journeyListeners = new Set<() => void>();

function commitJourney(next: BenchJourney) {
  if (journey.open === next.open && journey.mounted === next.mounted) {
    return;
  }

  journey = next;
  journeyListeners.forEach((listener) => listener());
  requestBenchRender();
}

/**
 * While the overlay is open the journey's own store answers Escape, and only
 * the bench ladder decides when the overlay itself closes. The overlay
 * registers its store's single-step unwind here; the delegate returns true
 * once the journey has fully unwound to 'closed', which is the bench's cue to
 * drop the overlay. One delegate rather than a listener list, for the same
 * reason the ladder is one handler: two responders to a keystroke would have
 * no defined order between them.
 */
let journeyEscapeDelegate: (() => boolean) | null = null;

export function setBenchJourneyEscapeDelegate(
  delegate: (() => boolean) | null,
) {
  journeyEscapeDelegate = delegate;
}

/**
 * Whether the DOM overlay may actually stand up. `open` is the intent — set by
 * the gesture, read by the escape ladder — and the overlay itself waits for
 * this later flag so the camera's flight to the laptop screen plays in the
 * clear rather than under an opaque sheet. The renderer promotes it when the
 * journey transit lands; with no Canvas attached (no WebGL, or the scene not
 * mounted) there is no flight to wait for and the open itself grants it.
 *
 * Not a field of `BenchJourney`: the reveal only ever changes inside an open
 * or close that already notifies, or through `revealBenchJourney`, which
 * notifies the same listener set itself.
 */
let journeyRevealed = false;

export function readBenchJourneyRevealed() {
  return journeyRevealed;
}

/** Renderer-only: stand the overlay up once the entry flight has landed. */
export function revealBenchJourney() {
  if (!journey.open || journeyRevealed) {
    return;
  }

  journeyRevealed = true;
  journeyListeners.forEach((listener) => listener());
}

export function openBenchJourney() {
  if (journey.open) {
    return;
  }

  /*
   * The overlay owns the whole viewport, so every camera-owning sub-view of
   * `work` stands down — an open tag record or gallery would otherwise still
   * hold the lens when the overlay lifts. The device selection is left alone
   * on purpose: the coming journey camera shot keys off this channel directly
   * (the gallery precedent), not off `focus`, so forcing the Personal Env
   * selection here would only make the work lens lean fight that shot.
   */
  closeBenchGallery();
  clearBenchTagSelection();
  setBenchTagHover(-1);

  /*
   * Reset on open as well as on close: the journey store is module-global and
   * also drives the standalone /journey route, so a visitor who played there
   * and client-navigated here would otherwise get an overlay that opens
   * mid-chapter — no overlay close ran to reset it. resetJourney bails on
   * equality, so this is free when the state is already neutral.
   */
  resetJourney();
  /*
   * Discard any focus flag a reset (or an earlier close) left pending: the
   * overlay's mount deliberately focuses the dialog container, and a stale
   * flag would instead auto-focus the wake hint, whose onFocus wakes the
   * screen and skips the near-dark waking reveal. Not cleared inside
   * resetJourney itself — the in-session "Start again" relies on the flag to
   * move focus into the fresh wake screen.
   */
  consumeJourneyFocus();
  /*
   * Rides the open's own notify. With a renderer attached the overlay waits
   * for the flight; without one there is nothing to fly and the overlay is
   * the whole experience, so it stands up on this same commit.
   */
  journeyRevealed = renderInvalidator === null;
  commitJourney({ open: true, mounted: true });
}

export function closeBenchJourney() {
  if (!journey.open) {
    return;
  }

  /* The overlay leaves first; the exit flight then plays in the clear. */
  journeyRevealed = false;
  /*
   * Mirror of the open-side reveal shortcut: with no renderer attached there
   * is no exit flight to wait for and releaseBenchJourney can never run, so
   * `mounted` drops on this same commit — a wedged `mounted: true` would
   * silently refuse the gallery and tag records for the rest of the page.
   */
  commitJourney({ open: false, mounted: renderInvalidator !== null });

  /*
   * A fresh overlay every time: the journey store is module-global and the
   * Bench is mounted on two routes, so without this a reopened overlay would
   * resume mid-chapter instead of waking the near-dark screen.
   */
  resetJourney();
  /*
   * The reset's own status commit flags a focus swap, but the overlay
   * unmounts in the same batch and nothing consumes it — left pending, the
   * next open (or the standalone /journey route's next render) would steal
   * focus and auto-wake the screen.
   */
  consumeJourneyFocus();
}

/** Renderer-only: drop the screen portal once its exit transit has landed. */
export function releaseBenchJourney() {
  if (journey.open || !journey.mounted) {
    return;
  }

  commitJourney({ ...journey, mounted: false });
}

export function readBenchJourney() {
  return journey;
}

export function subscribeBenchJourney(listener: () => void) {
  journeyListeners.add(listener);
  retainEscape();

  return () => {
    journeyListeners.delete(listener);
    releaseEscape();
  };
}

/**
 * Escape unwinds one level at a time — the journey overlay's own ladder while
 * it is open, otherwise the focused piece, then the gallery, then
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

  /*
   * First rung: the open journey overlay owns the key outright. Its store
   * unwinds one level per press through the registered delegate, and only a
   * delegate reporting the journey fully unwound — or no delegate at all, the
   * overlay not yet mounted — lets the bench drop the overlay. Either way
   * nothing behind the overlay may move on the same press.
   */
  if (journey.open) {
    if (!journeyEscapeDelegate || journeyEscapeDelegate() === true) {
      closeBenchJourney();
    }

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
  requestBenchRender();
}

export function setBenchTagHover(index: number) {
  commitTags({ ...tags, hovered: index });
}

export function setBenchTagSelection(index: number) {
  if (gallery.open) {
    return;
  }

  /* Same wall as the gallery: an engaged journey owns the lens outright. */
  if (journey.open || journey.mounted) {
    return;
  }

  /* The tag shot owns the lens, so a device selection has to stand down. */
  const clearedDevice = focus.selected >= 0;
  focus.selected = -1;
  commitTags({ ...tags, selected: index });

  if (clearedDevice) {
    requestBenchRender();
  }
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
  requestBenchRender();
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
  requestBenchRender();
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
    const changedFocus = focus.selected >= 0;
    focus.selected = -1;

    if (changedFocus) {
      requestBenchRender();
    }
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
