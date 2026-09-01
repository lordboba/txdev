/*
 * The journey overlay channel and its escape contract. Order-dependent within
 * the file (the store is a module singleton): every test puts the module back
 * to neutral — journey closed, no selections, no delegate — before it returns.
 *
 * The escape ladder binds to `window` with the first subscriber, and node has
 * none, so a minimal shim stands in before anything subscribes. The bench
 * handler only ever reads `event.key`, so a bare object is a valid event. The
 * journey store's own keydown handler never registers here — no journey
 * subscription is taken — which is also what keeps the ordering test honest:
 * only the bench ladder answers these presses.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const keydownListeners = new Set();
globalThis.window = {
  addEventListener(type, listener) {
    if (type === 'keydown') {
      keydownListeners.add(listener);
    }
  },
  removeEventListener(type, listener) {
    if (type === 'keydown') {
      keydownListeners.delete(listener);
    }
  },
};

const {
  closeBenchGallery,
  closeBenchJourney,
  openBenchGallery,
  openBenchJourney,
  readBenchGallery,
  readBenchJourney,
  readBenchJourneyRevealed,
  readBenchSignals,
  readBenchTags,
  releaseBenchGallery,
  releaseBenchJourney,
  revealBenchJourney,
  setBenchJourneyEscapeDelegate,
  setBenchRenderInvalidator,
  setBenchSignalSelection,
  setBenchTagSelection,
  subscribeBenchJourney,
} = await import('./benchStore.ts');

const {
  enterJourneyChapter,
  escapeJourney,
  readJourneyProgress,
  readJourneyState,
  setJourneyEmbedded,
  wakeJourney,
} = await import('../../journey/journeyStore.ts');

function pressEscape() {
  [...keydownListeners].forEach((listener) => listener({ key: 'Escape' }));
}

test('opening the journey stands the camera-owning sub-views down', () => {
  setBenchTagSelection(2);
  openBenchJourney();

  assert.deepEqual(readBenchJourney(), { open: true, mounted: true });
  assert.equal(readBenchTags().selected, -1);
  assert.equal(readBenchTags().hovered, -1);

  closeBenchJourney();
  releaseBenchJourney();

  openBenchGallery();
  openBenchJourney();

  assert.equal(readBenchGallery().open, false);
  assert.equal(readBenchJourney().open, true);

  closeBenchJourney();
  releaseBenchJourney();
});

test('escape answers the open journey before any other rung', () => {
  const stop = subscribeBenchJourney(() => {});

  openBenchJourney();
  /*
   * A signal selection opened behind the overlay must not hear the first
   * press. Signals rather than a tag record here: the tag channel now
   * refuses to open at all while the journey is engaged, so it can no
   * longer stand in as the lower rung.
   */
  setBenchSignalSelection(1);
  assert.equal(readBenchSignals().selected, 1);

  pressEscape();

  /* No delegate registered: the rung closes the overlay and stops there. */
  assert.equal(readBenchJourney().open, false);
  assert.equal(readBenchSignals().selected, 1);

  releaseBenchJourney();
  pressEscape();

  /* With the journey closed the ladder reaches the signal rung again. */
  assert.equal(readBenchSignals().selected, -1);

  stop();
});

test('an engaged journey refuses the gallery and the tag record', () => {
  openBenchJourney();

  /* Under the overlay (or mid entry flight) the tablet click bounces. */
  openBenchGallery();
  setBenchTagSelection(3);
  assert.equal(readBenchGallery().open, false);
  assert.equal(readBenchTags().selected, -1);

  closeBenchJourney();

  /* Still mounted: the exit flight owns the lens until the release. */
  openBenchGallery();
  setBenchTagSelection(3);
  assert.equal(readBenchGallery().open, false);
  assert.equal(readBenchTags().selected, -1);

  releaseBenchJourney();

  /* Fully released: both channels answer again. */
  openBenchGallery();
  assert.equal(readBenchGallery().open, true);
  closeBenchGallery();
  releaseBenchGallery();
});

test('the delegate decides whether escape may close the overlay', () => {
  let notified = 0;
  const stop = subscribeBenchJourney(() => {
    notified += 1;
  });
  let delegateCalls = 0;

  openBenchJourney();
  assert.equal(notified, 1);

  setBenchJourneyEscapeDelegate(() => {
    delegateCalls += 1;
    return false;
  });
  pressEscape();

  /* Still unwinding inside the game: the overlay stays, nobody re-renders. */
  assert.equal(delegateCalls, 1);
  assert.equal(readBenchJourney().open, true);
  assert.equal(notified, 1);

  setBenchJourneyEscapeDelegate(() => {
    delegateCalls += 1;
    return true;
  });
  pressEscape();

  assert.equal(delegateCalls, 2);
  assert.deepEqual(readBenchJourney(), { open: false, mounted: true });
  assert.equal(notified, 2);

  setBenchJourneyEscapeDelegate(null);
  releaseBenchJourney();
  stop();
});

test('an embedded run unwinds one level per press, then closes and resets', () => {
  setJourneyEmbedded(true);

  const stop = subscribeBenchJourney(() => {});
  /* The overlay's real delegate: one step, true once fully unwound. */
  setBenchJourneyEscapeDelegate(() => {
    escapeJourney();
    return readJourneyState().status === 'closed';
  });

  /* Open first — opening resets the journey — then play into a chapter. */
  openBenchJourney();
  wakeJourney();
  enterJourneyChapter();
  assert.equal(readJourneyState().status, 'chapter');

  pressEscape();

  assert.equal(readJourneyState().status, 'screen');
  assert.equal(readBenchJourney().open, true);

  pressEscape();

  /* screen → closed inside the game, and the bench drops and resets it. */
  assert.equal(readBenchJourney().open, false);
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'waking' });
  assert.deepEqual(readJourneyProgress(), {
    visitedBeatIds: [],
    keepsakes: [],
  });

  setBenchJourneyEscapeDelegate(null);
  setJourneyEmbedded(false);
  releaseBenchJourney();
  stop();
});

test('a plain close resets the journey store mid-run', () => {
  /* Open first — opening resets the journey — then play into a chapter. */
  openBenchJourney();
  wakeJourney();
  enterJourneyChapter();
  assert.equal(readJourneyState().status, 'chapter');

  closeBenchJourney();

  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'waking' });
  assert.deepEqual(readJourneyProgress(), {
    visitedBeatIds: [],
    keepsakes: [],
  });

  releaseBenchJourney();
});

test('opening the overlay resets a stale standalone run', () => {
  /*
   * Simulate the standalone /journey route played into a chapter: the journey
   * store moves with no overlay open, so no overlay close ever reset it.
   */
  wakeJourney();
  enterJourneyChapter();
  assert.equal(readJourneyState().status, 'chapter');

  openBenchJourney();

  /* The overlay must wake the near-dark screen, not resume mid-chapter. */
  assert.deepEqual(readJourneyState(), { status: 'screen', phase: 'waking' });
  assert.deepEqual(readJourneyProgress(), {
    visitedBeatIds: [],
    keepsakes: [],
  });

  closeBenchJourney();
  releaseBenchJourney();
});

test('open and close are idempotent, and release is renderer-only', () => {
  let notified = 0;
  const stop = subscribeBenchJourney(() => {
    notified += 1;
  });

  openBenchJourney();
  openBenchJourney();
  assert.equal(notified, 1);

  /* Release while open is refused: the portal cannot drop under the game. */
  releaseBenchJourney();
  assert.deepEqual(readBenchJourney(), { open: true, mounted: true });
  assert.equal(notified, 1);

  closeBenchJourney();
  closeBenchJourney();
  assert.equal(notified, 2);
  assert.deepEqual(readBenchJourney(), { open: false, mounted: true });

  releaseBenchJourney();
  assert.deepEqual(readBenchJourney(), { open: false, mounted: false });
  assert.equal(notified, 3);

  releaseBenchJourney();
  assert.equal(notified, 3);

  stop();
});

test('with no renderer the open grants the reveal on the same commit', () => {
  /* No invalidator registered here: the no-WebGL / no-canvas path. */
  openBenchJourney();
  assert.equal(readBenchJourneyRevealed(), true);

  closeBenchJourney();
  assert.equal(readBenchJourneyRevealed(), false);
  releaseBenchJourney();
});

test('with a renderer the reveal waits for the scene to promote it', () => {
  setBenchRenderInvalidator(() => {});
  let notified = 0;
  const stop = subscribeBenchJourney(() => {
    notified += 1;
  });

  openBenchJourney();
  assert.equal(readBenchJourneyRevealed(), false);
  assert.equal(notified, 1);

  /* The frame loop's promotion once the entry flight lands. */
  revealBenchJourney();
  assert.equal(readBenchJourneyRevealed(), true);
  assert.equal(notified, 2);

  /* Idempotent: the loop calls it gated, but a second call must not renotify. */
  revealBenchJourney();
  assert.equal(notified, 2);

  closeBenchJourney();
  assert.equal(readBenchJourneyRevealed(), false);

  releaseBenchJourney();
  setBenchRenderInvalidator(null);
  stop();
});

test('a reveal without an open journey is refused', () => {
  revealBenchJourney();
  assert.equal(readBenchJourneyRevealed(), false);
  assert.deepEqual(readBenchJourney(), { open: false, mounted: false });
});
