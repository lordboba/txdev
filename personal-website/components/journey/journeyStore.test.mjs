import assert from 'node:assert/strict';
import test from 'node:test';

import { journeyBeats, orderedBeatIds } from '../../content/journeyData.ts';
import {
  closeJourneyIndex,
  collectJourneyKeepsake,
  enterJourneyChapter,
  escapeJourney,
  finishJourney,
  moveJourneyToNode,
  nextJourneyBeat,
  openJourneyBeat,
  openJourneyIndex,
  prevJourneyBeat,
  readJourneyProgress,
  readJourneyState,
  recoverJourney,
  resetJourney,
  setJourneyEmbedded,
  setJourneyMode,
  subscribeJourneyProgress,
  subscribeJourneyState,
  wakeJourney,
} from './journeyStore.ts';

test('full happy path reaches the ending with the collected keepsakes', () => {
  resetJourney();
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'waking' });

  wakeJourney();
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'ready' });

  enterJourneyChapter();
  const first = readJourneyState();
  assert.equal(first.status, 'chapter');
  assert.equal(first.mode, 'explore');
  assert.equal(first.beatId, journeyBeats[0].nextId);
  assert.equal(first.nodeId, 'sd-practices');

  /* Detour onto a side node and pick up its keepsake. */
  assert.equal(moveJourneyToNode('sd-practice-artifact'), true);
  openJourneyBeat();
  assert.deepEqual(readJourneyProgress().keepsakes, ['scratch-or-cello']);
  assert.equal(moveJourneyToNode('sd-practices'), true);

  /* Walk the whole spine; the last beat's "next" is the ending. */
  for (let guard = 0; guard < orderedBeatIds.length; guard += 1) {
    if (readJourneyState().status !== 'chapter') break;
    nextJourneyBeat();
  }

  const ending = readJourneyState();
  assert.equal(ending.status, 'ending');
  assert.deepEqual(ending.keepsakes, ['scratch-or-cello']);
  assert.deepEqual(readJourneyProgress().visitedBeatIds, [
    '01-practices',
    '02-del-norte',
    '03-first-app',
    '04-ucla',
    '05-safetykit',
    '06-codex',
    '07-ramp',
    '08-decagon',
    '09-horizon',
  ]);
});

test('movement is adjacency-validated and invalid moves are silent no-ops', () => {
  resetJourney();
  wakeJourney();
  enterJourneyChapter('01-practices');

  let notified = 0;
  const stop = subscribeJourneyState(() => {
    notified += 1;
  });

  /* Not adjacent (different map), unknown, and self are all refused. */
  assert.equal(moveJourneyToNode('sf-safetykit'), false);
  assert.equal(moveJourneyToNode('no-such-node'), false);
  assert.equal(moveJourneyToNode('sd-practices'), false);
  assert.equal(notified, 0);
  assert.equal(readJourneyState().nodeId, 'sd-practices');

  assert.equal(moveJourneyToNode('sd-del-norte'), true);
  assert.equal(notified, 1);
  assert.equal(readJourneyState().beatId, '02-del-norte');

  /* A side node keeps the current beat in the story panel. */
  assert.equal(moveJourneyToNode('sd-track-artifact'), true);
  assert.equal(readJourneyState().beatId, '02-del-norte');
  assert.equal(readJourneyState().nodeId, 'sd-track-artifact');

  stop();
});

test('next and prev page through beats in read mode', () => {
  resetJourney();
  wakeJourney();
  enterJourneyChapter('01-practices', 'read');
  assert.equal(readJourneyState().mode, 'read');

  nextJourneyBeat();
  assert.equal(readJourneyState().beatId, '02-del-norte');
  assert.equal(readJourneyState().mode, 'read');

  prevJourneyBeat();
  assert.equal(readJourneyState().beatId, '01-practices');

  /* Prev can page back onto the wake beat, and stops there. */
  prevJourneyBeat();
  assert.equal(readJourneyState().beatId, '00-wake');
  prevJourneyBeat();
  assert.equal(readJourneyState().beatId, '00-wake');

  /* Read mode still lands each beat on its map node. */
  nextJourneyBeat();
  assert.equal(readJourneyState().nodeId, 'sd-practices');
});

test('Escape unwinds exactly one level at a time, in order', () => {
  resetJourney();
  setJourneyEmbedded(false);
  wakeJourney();
  enterJourneyChapter('05-safetykit', 'read');
  openJourneyIndex();
  assert.equal(readJourneyState().status, 'index');

  /* index → the chapter it covered, with read mode restored */
  assert.equal(escapeJourney(), true);
  assert.deepEqual(readJourneyState(), {
    status: 'chapter',
    mode: 'read',
    beatId: '05-safetykit',
    nodeId: 'sf-safetykit',
  });

  /* read → explore */
  assert.equal(escapeJourney(), true);
  assert.equal(readJourneyState().mode, 'explore');

  /* chapter → wake screen */
  assert.equal(escapeJourney(), true);
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'ready' });

  /* standalone route: the final Escape does nothing */
  assert.equal(escapeJourney(), false);
  assert.equal(readJourneyState().status, 'screen');

  /* embedded: the final Escape closes the journey */
  setJourneyEmbedded(true);
  assert.equal(escapeJourney(), true);
  assert.deepEqual(readJourneyState(), { status: 'closed' });
  setJourneyEmbedded(false);
});

test('leaving embedded mode reopens a closed journey for the standalone route', () => {
  resetJourney();
  setJourneyEmbedded(true);

  /* Embedded: the final Escape closes the journey behind the overlay. */
  assert.equal(escapeJourney(), true);
  assert.deepEqual(readJourneyState(), { status: 'closed' });

  /* Standalone /journey render: never a dead wake screen. */
  setJourneyEmbedded(false);
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'waking' });

  wakeJourney();
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'ready' });
});

test('picking a chapter from the index keeps read mode', () => {
  resetJourney();
  wakeJourney();
  enterJourneyChapter('01-practices', 'read');
  openJourneyIndex();

  /* Index rows navigate without passing a mode. */
  enterJourneyChapter('05-safetykit');
  assert.deepEqual(readJourneyState(), {
    status: 'chapter',
    mode: 'read',
    beatId: '05-safetykit',
    nodeId: 'sf-safetykit',
  });

  /* And an explore detour stays explore. */
  setJourneyMode('explore');
  openJourneyIndex();
  enterJourneyChapter('02-del-norte');
  assert.equal(readJourneyState().mode, 'explore');
});

test('Escape from the ending returns to the last visited chapter', () => {
  resetJourney();
  wakeJourney();
  enterJourneyChapter('09-horizon');
  finishJourney();
  assert.equal(readJourneyState().status, 'ending');

  assert.equal(escapeJourney(), true);
  assert.equal(readJourneyState().status, 'chapter');
  assert.equal(readJourneyState().beatId, '09-horizon');
});

test('reset is idempotent and a second reset notifies nobody', () => {
  resetJourney();
  wakeJourney();
  enterJourneyChapter('03-first-app');
  collectJourneyKeepsake('portrait');

  let stateNotified = 0;
  let progressNotified = 0;
  const stopState = subscribeJourneyState(() => {
    stateNotified += 1;
  });
  const stopProgress = subscribeJourneyProgress(() => {
    progressNotified += 1;
  });

  resetJourney();
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'waking' });
  assert.deepEqual(readJourneyProgress(), {
    visitedBeatIds: [],
    keepsakes: [],
  });
  assert.equal(stateNotified, 1);
  assert.equal(progressNotified, 1);

  resetJourney();
  assert.equal(stateNotified, 1);
  assert.equal(progressNotified, 1);

  stopState();
  stopProgress();
});

test('an invalid beat commits the error state and recovery resets safely', () => {
  resetJourney();
  wakeJourney();
  enterJourneyChapter('02-del-norte');

  enterJourneyChapter('no-such-beat');
  assert.deepEqual(readJourneyState(), { status: 'error', recoverTo: 'story' });

  recoverJourney();
  assert.deepEqual(readJourneyState(), {
    status: 'chapter',
    mode: 'explore',
    beatId: '02-del-norte',
    nodeId: 'sd-del-norte',
  });

  /* An index whose return target went stale also lands on solid ground. */
  openJourneyIndex();
  enterJourneyChapter('still-not-a-beat');
  assert.deepEqual(readJourneyState(), { status: 'error', recoverTo: 'index' });
  recoverJourney();
  assert.equal(readJourneyState().status, 'index');
  closeJourneyIndex();
  assert.equal(readJourneyState().status, 'chapter');
  assert.equal(readJourneyState().beatId, '02-del-norte');
});

test('commits are idempotent: repeated actions notify nobody twice', () => {
  resetJourney();
  wakeJourney();
  enterJourneyChapter('01-practices');

  let stateNotified = 0;
  let progressNotified = 0;
  const stopState = subscribeJourneyState(() => {
    stateNotified += 1;
  });
  const stopProgress = subscribeJourneyProgress(() => {
    progressNotified += 1;
  });

  /* Same chapter, same mode, wake on a woken screen: all bail. */
  enterJourneyChapter('01-practices');
  setJourneyMode('explore');
  wakeJourney();
  openJourneyBeat();
  assert.equal(stateNotified, 0);

  /* Collecting the same keepsake twice leaves one entry and one notify. */
  collectJourneyKeepsake('portrait');
  collectJourneyKeepsake('portrait');
  assert.equal(progressNotified, 1);
  assert.deepEqual(readJourneyProgress().keepsakes, ['portrait']);

  /* An unknown keepsake is refused outright. */
  collectJourneyKeepsake('not-an-artifact');
  assert.equal(progressNotified, 1);

  stopState();
  stopProgress();
});

test('finish snapshots keepsakes and only fires from a live journey', () => {
  resetJourney();

  /* Not in a chapter or index: no-op. */
  finishJourney();
  assert.equal(readJourneyState().status, 'screen');

  wakeJourney();
  enterJourneyChapter('09-horizon');
  collectJourneyKeepsake('unprinted-margin');
  finishJourney();

  const ending = readJourneyState();
  assert.equal(ending.status, 'ending');
  assert.deepEqual(ending.keepsakes, ['unprinted-margin']);

  resetJourney();
});
