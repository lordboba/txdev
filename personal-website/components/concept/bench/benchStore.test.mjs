import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearBenchSelection,
  readBenchFocus,
  setBenchHover,
  setBenchSelection,
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
