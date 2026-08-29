import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearBenchHistorySelection,
  clearBenchSelection,
  clearBenchSignalSelection,
  clearBenchTagSelection,
  closeBenchHistoryLightbox,
  markBenchHistoryLive,
  openBenchHistoryLightbox,
  readBenchFocus,
  readBenchHistory,
  readBenchSettled,
  readBenchSignals,
  readBenchTags,
  setBenchPointer,
  setBenchRenderInvalidator,
  setBenchSettled,
  setBenchHistorySelection,
  setBenchHover,
  setBenchSelection,
  setBenchSignalHover,
  setBenchSignalSelection,
  setBenchTagHover,
  setBenchTagSelection,
  subscribeBenchHistory,
  subscribeBenchSettled,
  subscribeBenchSignals,
} from './benchStore.ts';

test('pointer and focus changes wake the renderer once per state change', () => {
  let notified = 0;
  setBenchRenderInvalidator(() => {
    notified += 1;
  });

  setBenchPointer(0.25, -0.5);
  assert.equal(notified, 1);

  setBenchPointer(0.25, -0.5);
  assert.equal(notified, 1);

  setBenchHover('work', 3);
  assert.equal(notified, 2);

  setBenchHover('work', 3);
  assert.equal(notified, 2);

  setBenchRenderInvalidator(null);
  setBenchPointer(0, 0);
  assert.equal(notified, 2);
});

test('the bench settles only after every independent motion source settles', () => {
  setBenchSettled('scene', true);
  setBenchSettled('tags', true);
  setBenchSettled('gallery', true);
  assert.equal(readBenchSettled(), true);

  let notified = 0;
  const stop = subscribeBenchSettled(() => {
    notified += 1;
  });

  setBenchSettled('scene', false);
  setBenchSettled('gallery', false);
  assert.equal(readBenchSettled(), false);
  assert.equal(notified, 1);

  setBenchSettled('scene', true);
  assert.equal(readBenchSettled(), false);
  assert.equal(notified, 1);

  setBenchSettled('gallery', true);
  assert.equal(readBenchSettled(), true);
  assert.equal(notified, 2);

  stop();
});

test('focus state is isolated by view', () => {
  setBenchSelection('work', 1);
  setBenchHover('history', -1);

  assert.deepEqual(readBenchFocus('history'), {
    hovered: -1,
    selected: -1,
  });

  setBenchHover('history', 4);
  setBenchSelection('signals', 0);

  assert.deepEqual(readBenchFocus('signals'), {
    hovered: -1,
    selected: 0,
  });
});

test('selection can be cleared without clearing hover', () => {
  setBenchHover('work', 2);
  setBenchSelection('work', 1);
  clearBenchSelection();

  assert.deepEqual(readBenchFocus('work'), {
    hovered: 2,
    selected: -1,
  });
});

test('device and tag selection are mutually exclusive in the work view', () => {
  clearBenchTagSelection();
  setBenchSelection('work', 2);
  setBenchTagHover(3);
  setBenchTagSelection(1);

  assert.equal(readBenchFocus('work').selected, -1);
  assert.deepEqual(readBenchTags(), { hovered: 3, selected: 1 });

  setBenchSelection('work', 0);

  assert.equal(readBenchFocus('work').selected, 0);
  assert.equal(readBenchTags().selected, -1);
});

test('clearing a tag record leaves its hover alone', () => {
  setBenchTagHover(4);
  setBenchTagSelection(4);
  clearBenchTagSelection();

  assert.deepEqual(readBenchTags(), { hovered: 4, selected: -1 });
});

test('an open signal notifies, and clearing it leaves its hover alone', () => {
  let notified = 0;
  const stop = subscribeBenchSignals(() => {
    notified += 1;
  });

  setBenchSignalHover(2);
  setBenchSignalSelection(2);

  assert.deepEqual(readBenchSignals(), { hovered: 2, selected: 2 });
  assert.equal(notified, 2);

  clearBenchSignalSelection();

  assert.deepEqual(readBenchSignals(), { hovered: 2, selected: -1 });

  /* Idempotent: a second clear must not wake every subscriber again. */
  const settled = notified;
  clearBenchSignalSelection();
  assert.equal(notified, settled);

  stop();
});

test('signals and company tags are independent channels', () => {
  setBenchSignalSelection(1);
  setBenchTagSelection(3);

  assert.equal(readBenchSignals().selected, 1);
  assert.equal(readBenchTags().selected, 3);

  clearBenchTagSelection();
  assert.equal(readBenchSignals().selected, 1);

  clearBenchSignalSelection();
  setBenchSignalHover(-1);
});

test("an opened era drives the renderer's focus record as well as the DOM", () => {
  let notified = 0;
  const stop = subscribeBenchHistory(() => {
    notified += 1;
  });

  setBenchHistorySelection(2);

  assert.equal(readBenchHistory().selected, 2);
  /* The scene reads `focus`, so the two surfaces cannot disagree. */
  assert.equal(readBenchFocus('history').selected, 2);
  assert.equal(notified, 1);

  clearBenchHistorySelection();

  assert.equal(readBenchHistory().selected, -1);
  assert.equal(readBenchFocus('history').selected, -1);

  /* Idempotent: a second clear must not wake every subscriber again. */
  const settled = notified;
  clearBenchHistorySelection();
  assert.equal(notified, settled);

  stop();
});

test('the capture only opens over an era that is actually open', () => {
  clearBenchHistorySelection();
  openBenchHistoryLightbox();
  assert.equal(readBenchHistory().lightbox, false);

  setBenchHistorySelection(0);
  openBenchHistoryLightbox();
  assert.equal(readBenchHistory().lightbox, true);

  /* Picking a different era closes the capture opened over the last one. */
  setBenchHistorySelection(1);
  assert.equal(readBenchHistory().lightbox, false);

  openBenchHistoryLightbox();
  closeBenchHistoryLightbox();
  assert.equal(readBenchHistory().lightbox, false);

  clearBenchHistorySelection();
});

test('the era captures mount once and never unmount', () => {
  assert.equal(readBenchHistory().live, false);

  markBenchHistoryLive();
  assert.equal(readBenchHistory().live, true);

  setBenchHistorySelection(3);
  clearBenchHistorySelection();
  assert.equal(readBenchHistory().live, true);
});
