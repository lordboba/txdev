'use client';

import {
  journeyArtifacts,
  journeyBeats,
  journeyNodes,
  orderedBeatIds,
  type JourneyMapNode,
} from '../../content/journeyData.ts';

export type JourneyMode = 'explore' | 'read';

/**
 * The whole experience as one union — the spec's JourneyState. Every view the
 * component can show is one of these shapes, so there is no way to be "in the
 * index" and "on a chapter" at once, and recovery is a single well-formed
 * commit rather than a cleanup across scattered flags.
 */
export type JourneyState =
  | { status: 'closed' }
  | { status: 'screen'; phase: 'waking' | 'ready' }
  | {
      status: 'chapter';
      mode: JourneyMode;
      beatId: string;
      nodeId: string;
    }
  | { status: 'index'; returnTo: string }
  | { status: 'ending'; keepsakes: string[] }
  | { status: 'error'; recoverTo: 'story' | 'index' };

/**
 * What the visitor has gathered, separate from where they are standing.
 * The route drawing and the keepsake ledger read this channel; the map reads
 * `state`. Two channels so travelling does not re-render the ledger and
 * collecting does not re-render the map's position.
 */
export type JourneyProgress = {
  visitedBeatIds: string[];
  keepsakes: string[];
};

type MainNode = Extract<JourneyMapNode, { kind: 'main' }>;

const beatsById = new Map(journeyBeats.map((beat) => [beat.id, beat]));
const nodesById = new Map(journeyNodes.map((node) => [node.id, node]));
const mainNodeByBeatId = new Map<string, MainNode>(
  journeyNodes
    .filter((node): node is MainNode => node.kind === 'main')
    .map((node) => [node.beatId, node]),
);
const artifactIds = new Set(journeyArtifacts.map((artifact) => artifact.id));

/**
 * The wake screen already presents the first beat's copy, so entering the
 * chapters by default starts at the beat after it — data-driven, not a
 * hard-coded id.
 */
const defaultChapterBeatId = journeyBeats[0].nextId ?? orderedBeatIds[0];

const initialState: JourneyState = { status: 'screen', phase: 'waking' };
const initialProgress: JourneyProgress = { visitedBeatIds: [], keepsakes: [] };

let state: JourneyState = initialState;
let progress: JourneyProgress = initialProgress;

const stateListeners = new Set<() => void>();
const progressListeners = new Set<() => void>();

/**
 * Escape from the wake screen only closes the journey when it is embedded in
 * the Bench overlay. On the direct /journey route there is nothing behind the
 * screen — browser back leaves the page, so the final Escape is a no-op.
 */
let embedded = false;

/** Restored when the index closes, so read mode survives a detour. */
let indexReturnMode: JourneyMode = 'explore';

export function setJourneyEmbedded(next: boolean) {
  embedded = next;

  /*
   * The standalone route can never sit in 'closed': module state survives SPA
   * navigation, so a journey closed inside the Bench overlay must reopen when
   * /journey renders it standalone again.
   */
  if (!next) {
    openJourney();
  }
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameState(a: JourneyState, b: JourneyState) {
  if (a === b) {
    return true;
  }
  if (a.status !== b.status) {
    return false;
  }

  switch (a.status) {
    case 'closed':
      return true;
    case 'screen':
      return a.phase === (b as typeof a).phase;
    case 'chapter': {
      const next = b as typeof a;
      return (
        a.mode === next.mode &&
        a.beatId === next.beatId &&
        a.nodeId === next.nodeId
      );
    }
    case 'index':
      return a.returnTo === (b as typeof a).returnTo;
    case 'ending':
      return sameList(a.keepsakes, (b as typeof a).keepsakes);
    case 'error':
      return a.recoverTo === (b as typeof a).recoverTo;
  }
}

/**
 * Set once per view swap (a commit that changes `status`), consumed by the
 * component's mount refs so keyboard focus lands inside the new view instead
 * of falling to <body> when the old subtree unmounts. Never set on the very
 * first render — page load must not steal focus.
 */
let focusPending = false;

export function consumeJourneyFocus(): boolean {
  const pending = focusPending;
  focusPending = false;
  return pending;
}

function commitState(next: JourneyState) {
  if (sameState(state, next)) {
    return;
  }

  if (state.status !== next.status) {
    focusPending = true;
  }

  state = next;
  stateListeners.forEach((listener) => listener());
}

function commitProgress(next: JourneyProgress) {
  if (
    sameList(progress.visitedBeatIds, next.visitedBeatIds) &&
    sameList(progress.keepsakes, next.keepsakes)
  ) {
    return;
  }

  progress = next;
  progressListeners.forEach((listener) => listener());
}

function markVisited(beatId: string) {
  if (progress.visitedBeatIds.includes(beatId)) {
    return;
  }

  commitProgress({
    ...progress,
    visitedBeatIds: [...progress.visitedBeatIds, beatId],
  });
}

/** The furthest visited beat that still resolves — resume and recovery point. */
function lastValidVisitedBeatId() {
  for (let i = progress.visitedBeatIds.length - 1; i >= 0; i -= 1) {
    const id = progress.visitedBeatIds[i];
    if (beatsById.has(id) && mainNodeByBeatId.has(id)) {
      return id;
    }
  }

  return null;
}

export function openJourney() {
  if (state.status !== 'closed') {
    return;
  }

  commitState({ status: 'screen', phase: 'waking' });
}

export function wakeJourney() {
  if (state.status !== 'screen' || state.phase === 'ready') {
    return;
  }

  commitState({ status: 'screen', phase: 'ready' });
}

/**
 * Enter (or jump to) a chapter. An unknown beat commits the spec's error
 * state instead of stranding the visitor — recovery then resets to the last
 * place that still resolves. With no argument it resumes where the visitor
 * last was, falling back to the first chapter.
 */
export function enterJourneyChapter(beatId?: string, mode?: JourneyMode) {
  const targetId = beatId ?? lastValidVisitedBeatId() ?? defaultChapterBeatId;
  const beat = beatsById.get(targetId);
  const node = mainNodeByBeatId.get(targetId);

  if (!beat || !node) {
    commitState({
      status: 'error',
      recoverTo: state.status === 'index' ? 'index' : 'story',
    });
    return;
  }

  /* From the index, the saved mode carries through — read survives a detour. */
  const nextMode =
    mode ??
    (state.status === 'chapter'
      ? state.mode
      : state.status === 'index'
        ? indexReturnMode
        : 'explore');
  commitState({
    status: 'chapter',
    mode: nextMode,
    beatId: targetId,
    nodeId: node.id,
  });
  markVisited(targetId);
}

/**
 * Adjacency-validated travel: only a node connected to the one the visitor is
 * standing on. Anything else is a no-op — arrows can never teleport, and a
 * stale node id can never produce an impossible position. Returns whether the
 * move happened, so the keyboard handler knows whether to swallow the key.
 */
export function moveJourneyToNode(nodeId: string): boolean {
  if (state.status !== 'chapter') {
    return false;
  }

  const current = nodesById.get(state.nodeId);
  const target = nodesById.get(nodeId);

  if (!current || !target || !current.adjacency.includes(nodeId)) {
    return false;
  }

  const beatId = target.kind === 'main' ? target.beatId : state.beatId;
  commitState({ status: 'chapter', mode: state.mode, beatId, nodeId });

  if (target.kind === 'main') {
    markVisited(target.beatId);
  }

  return true;
}

/** Best adjacent node in a screen direction (y grows downward). */
export function moveJourneyInDirection(dx: number, dy: number): boolean {
  if (state.status !== 'chapter') {
    return false;
  }

  const current = nodesById.get(state.nodeId);

  if (!current) {
    return false;
  }

  let best: string | null = null;
  let bestScore = 0.35;

  for (const id of current.adjacency) {
    const candidate = nodesById.get(id);

    if (!candidate) {
      continue;
    }

    const vx = candidate.x - current.x;
    const vy = candidate.y - current.y;
    const length = Math.hypot(vx, vy) || 1;
    const score = (vx * dx + vy * dy) / length;

    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return best !== null && moveJourneyToNode(best);
}

/**
 * Open whatever the visitor is standing on: a main node brings its beat into
 * the story panel, a side node leaves its artifact in the keepsake ledger.
 */
export function openJourneyBeat() {
  if (state.status !== 'chapter') {
    return;
  }

  const node = nodesById.get(state.nodeId);

  if (!node) {
    return;
  }

  if (node.kind === 'main') {
    commitState({ ...state, beatId: node.beatId });
    markVisited(node.beatId);
    return;
  }

  collectJourneyKeepsake(node.artifactId);
}

export function nextJourneyBeat() {
  if (state.status !== 'chapter') {
    return;
  }

  const beat = beatsById.get(state.beatId);

  if (!beat) {
    return;
  }

  if (beat.nextId === null) {
    finishJourney();
    return;
  }

  enterJourneyChapter(beat.nextId, state.mode);
}

export function prevJourneyBeat() {
  if (state.status !== 'chapter') {
    return;
  }

  const index = orderedBeatIds.indexOf(state.beatId);

  if (index <= 0) {
    return;
  }

  enterJourneyChapter(orderedBeatIds[index - 1], state.mode);
}

export function setJourneyMode(mode: JourneyMode) {
  if (state.status !== 'chapter' || state.mode === mode) {
    return;
  }

  commitState({ ...state, mode });
}

export function openJourneyIndex() {
  if (state.status === 'chapter') {
    indexReturnMode = state.mode;
    commitState({ status: 'index', returnTo: state.beatId });
    return;
  }

  if (state.status === 'ending') {
    indexReturnMode = 'explore';
    commitState({
      status: 'index',
      returnTo: lastValidVisitedBeatId() ?? defaultChapterBeatId,
    });
  }
}

export function closeJourneyIndex() {
  if (state.status !== 'index') {
    return;
  }

  const returnTo = state.returnTo;

  if (beatsById.has(returnTo) && mainNodeByBeatId.has(returnTo)) {
    enterJourneyChapter(returnTo, indexReturnMode);
    return;
  }

  /* Invalid return target: reset safely to the last place that resolves. */
  enterJourneyChapter(undefined, indexReturnMode);
}

export function collectJourneyKeepsake(artifactId: string) {
  if (!artifactIds.has(artifactId) || progress.keepsakes.includes(artifactId)) {
    return;
  }

  commitProgress({
    ...progress,
    keepsakes: [...progress.keepsakes, artifactId],
  });
}

export function finishJourney() {
  if (state.status !== 'chapter' && state.status !== 'index') {
    return;
  }

  commitState({ status: 'ending', keepsakes: [...progress.keepsakes] });
}

/** Leave the error state for solid ground. */
export function recoverJourney() {
  if (state.status !== 'error') {
    return;
  }

  if (state.recoverTo === 'index') {
    indexReturnMode = 'explore';
    commitState({
      status: 'index',
      returnTo: lastValidVisitedBeatId() ?? defaultChapterBeatId,
    });
    return;
  }

  enterJourneyChapter(lastValidVisitedBeatId() ?? defaultChapterBeatId);
}

export function resetJourney() {
  commitState(initialState);
  commitProgress(initialProgress);
}

/**
 * Escape unwinds one level at a time: error → recovery, index → the chapter
 * it covered, read → explore, chapter → the wake screen, ending → the last
 * chapter, and finally screen → closed only when the journey is embedded.
 * Returns whether it consumed the key.
 */
export function escapeJourney(): boolean {
  switch (state.status) {
    case 'error':
      recoverJourney();
      return true;
    case 'index':
      closeJourneyIndex();
      return true;
    case 'chapter':
      if (state.mode === 'read') {
        setJourneyMode('explore');
        return true;
      }

      commitState({ status: 'screen', phase: 'ready' });
      return true;
    case 'ending':
      enterJourneyChapter(lastValidVisitedBeatId() ?? defaultChapterBeatId);
      return true;
    case 'screen':
      if (embedded) {
        commitState({ status: 'closed' });
        return true;
      }

      return false;
    case 'closed':
      return false;
  }
}

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  W: [0, -1],
  S: [0, 1],
  A: [-1, 0],
  D: [1, 0],
};

/**
 * One window-level handler no matter how many surfaces subscribe, bound with
 * the first subscriber and torn down with the last (the Bench's refcounted
 * retain/release pattern). Native activation is left alone: Enter or Space on
 * a real button fires its click, so the handler only claims those keys when
 * focus is on non-interactive ground.
 */
function handleJourneyKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return;
  }

  const target = event.target;

  if (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable="true"]')
  ) {
    return;
  }

  if (event.key === 'Escape') {
    /*
     * Embedded, the Bench's window handler owns Escape: both stores bind
     * window keydown, and exactly one may act per press. The bench ladder's
     * first rung calls this store's unwind through its registered delegate,
     * so acting here as well would unwind two levels per keystroke.
     */
    if (embedded) {
      return;
    }

    if (escapeJourney()) {
      event.preventDefault();
    }

    return;
  }

  const direction = DIRECTIONS[event.key];

  if (direction) {
    if (state.status !== 'chapter') {
      return;
    }

    /* Focus inside the story panel keeps its native arrow-key scrolling. */
    if (target instanceof Element && target.closest('[data-journey-story]')) {
      return;
    }

    if (state.mode === 'read') {
      /* Read mode is linear: sideways arrows page instead of travelling. */
      if (direction[0] > 0) {
        nextJourneyBeat();
        event.preventDefault();
      } else if (direction[0] < 0) {
        prevJourneyBeat();
        event.preventDefault();
      }

      return;
    }

    if (moveJourneyInDirection(direction[0], direction[1])) {
      event.preventDefault();
    }

    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    /* The story panel keeps Space for scrolling, buttons their activation. */
    if (
      target instanceof Element &&
      target.closest(
        'button, a, input, select, textarea, [role="button"], [data-journey-story]',
      )
    ) {
      return;
    }

    if (state.status === 'screen') {
      if (state.phase === 'waking') {
        wakeJourney();
      } else {
        enterJourneyChapter();
      }

      event.preventDefault();
      return;
    }

    if (state.status === 'chapter') {
      openJourneyBeat();
      event.preventDefault();
    }
  }
}

let keyHolders = 0;

function retainKeys() {
  keyHolders += 1;

  if (keyHolders === 1 && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleJourneyKeydown);
  }
}

function releaseKeys() {
  keyHolders -= 1;

  if (keyHolders === 0 && typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleJourneyKeydown);
  }
}

export function readJourneyState() {
  return state;
}

export function subscribeJourneyState(listener: () => void) {
  stateListeners.add(listener);
  retainKeys();

  return () => {
    stateListeners.delete(listener);
    releaseKeys();
  };
}

export function readJourneyProgress() {
  return progress;
}

export function subscribeJourneyProgress(listener: () => void) {
  progressListeners.add(listener);
  retainKeys();

  return () => {
    progressListeners.delete(listener);
    releaseKeys();
  };
}
