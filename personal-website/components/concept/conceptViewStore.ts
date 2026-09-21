'use client';

import { useSyncExternalStore } from 'react';
import { conceptViews, type ConceptViewId } from './conceptData';

const CONCEPT_VIEW_EVENT = 'concept-view-change';
const DEFAULT_VIEW: ConceptViewId = 'profile';

/** Message the comparison board posts to drive every embedded concept at once. */
export const CONCEPT_VIEW_MESSAGE = 'concept:set-view';

function isConceptViewId(value: unknown): value is ConceptViewId {
  return (
    typeof value === 'string' && conceptViews.some((view) => view.id === value)
  );
}

let bridgeInstalled = false;

/**
 * Installed once, on first subscription. Lets /concept switch the view inside
 * all three preview frames without reloading them, so their transit
 * animations stay watchable side by side.
 */
function installBoardBridge() {
  if (bridgeInstalled || typeof window === 'undefined') {
    return;
  }

  bridgeInstalled = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    const data = event.data as { type?: unknown; view?: unknown } | null;

    if (data?.type === CONCEPT_VIEW_MESSAGE && isConceptViewId(data.view)) {
      setConceptView(data.view);
    }
  });
}

function getConceptViewSnapshot(defaultView: ConceptViewId): ConceptViewId {
  if (typeof window === 'undefined') {
    return defaultView;
  }

  const hash = window.location.hash.slice(1);
  return isConceptViewId(hash) ? hash : defaultView;
}

function subscribeToConceptView(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  installBoardBridge();
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener(CONCEPT_VIEW_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener(CONCEPT_VIEW_EVENT, onStoreChange);
  };
}

export function useConceptView(defaultView: ConceptViewId = DEFAULT_VIEW) {
  return useSyncExternalStore(
    subscribeToConceptView,
    () => getConceptViewSnapshot(defaultView),
    () => defaultView,
  );
}

export function setConceptView(viewId: ConceptViewId) {
  if (typeof window === 'undefined') {
    return;
  }

  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${search}#${viewId}`,
  );
  window.dispatchEvent(new Event(CONCEPT_VIEW_EVENT));
}
