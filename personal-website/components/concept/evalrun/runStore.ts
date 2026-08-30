'use client';

import { useSyncExternalStore } from 'react';
import type { ConceptViewId } from '../conceptData';
import { compileSuite, resolveSuiteAt, type RunSnapshot } from './runEngine';

type Listener = () => void;

const snapshotListeners = new Set<Listener>();
const timerListeners = new Set<Listener>();
const serverSnapshot = resolveSuiteAt(compileSuite('profile'), 0, 0, true);

let snapshot: RunSnapshot = serverSnapshot;
let startedAt = 0;
let frame = 0;
let timerVersion = 0;
let activeKey = '';

function stateSignature(value: RunSnapshot) {
  return value.cases.map((entry) => entry.state).join(':');
}

function emit(listeners: Set<Listener>) {
  for (const listener of listeners) {
    listener();
  }
}

function stopFrame() {
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

function tick(now: number) {
  const next = resolveSuiteAt(snapshot.suite, startedAt, now, false);
  const changed = stateSignature(next) !== stateSignature(snapshot);
  snapshot = next;
  timerVersion += 1;

  emit(timerListeners);

  if (changed) {
    emit(snapshotListeners);
  }

  if (!next.settled || next.suite.target === 'signals') {
    frame = requestAnimationFrame(tick);
  } else {
    frame = 0;
  }
}

function begin(view: ConceptViewId, reducedMotion: boolean, force: boolean) {
  const key = `${view}:${reducedMotion}`;

  if (!force && activeKey === key) {
    return;
  }

  activeKey = key;
  stopFrame();
  startedAt = performance.now();
  snapshot = resolveSuiteAt(
    compileSuite(view),
    startedAt,
    startedAt,
    reducedMotion,
  );
  timerVersion += 1;
  emit(snapshotListeners);
  emit(timerListeners);

  if (!reducedMotion) {
    frame = requestAnimationFrame(tick);
  }
}

export function enterSuite(view: ConceptViewId, reducedMotion: boolean) {
  begin(view, reducedMotion, false);
  const key = `${view}:${reducedMotion}`;

  return () => {
    if (activeKey === key) {
      activeKey = '';
      stopFrame();
    }
  };
}

export function replaySuite(view: ConceptViewId, reducedMotion: boolean) {
  begin(view, reducedMotion, true);
}

export function subscribeToRun(listener: Listener) {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}

export function getRunSnapshot() {
  return snapshot;
}

export function useRunSnapshot() {
  return useSyncExternalStore(
    subscribeToRun,
    getRunSnapshot,
    () => serverSnapshot,
  );
}

function subscribeToTimer(listener: Listener) {
  timerListeners.add(listener);
  return () => timerListeners.delete(listener);
}

function getTimerVersion() {
  return timerVersion;
}

export function useTimerTick() {
  useSyncExternalStore(subscribeToTimer, getTimerVersion, () => 0);
}
