import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./BenchScene.tsx', import.meta.url),
  'utf8',
);

test('profile portrait is turned upright without mutating the shared texture', () => {
  assert.match(source, /const uprightPortrait = useMemo/);
  assert.match(source, /const upright = portrait\.clone\(\)/);
  assert.match(source, /upright\.center\.set\(0\.5, 0\.5\)/);
  assert.match(source, /upright\.rotation = Math\.PI \/ 2/);
  assert.match(source, /map=\{uprightPortrait\}/);
  assert.doesNotMatch(source, /portrait\.rotation\s*=/);
});
