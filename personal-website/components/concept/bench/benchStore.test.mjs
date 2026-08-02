import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearBenchSelection,
  clearBenchTagSelection,
  readBenchFocus,
  readBenchTags,
  setBenchHover,
  setBenchSelection,
  setBenchTagHover,
  setBenchTagSelection,
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
