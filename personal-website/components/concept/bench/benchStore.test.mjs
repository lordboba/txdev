import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearBenchSelection,
  clearBenchSignalSelection,
  clearBenchTagSelection,
  readBenchFocus,
  readBenchSignals,
  readBenchTags,
  setBenchHover,
  setBenchSelection,
  setBenchSignalHover,
  setBenchSignalSelection,
  setBenchTagHover,
  setBenchTagSelection,
  subscribeBenchSignals,
} from './benchStore.ts';

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
