import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scene = await readFile(
  new URL('./BenchScene.tsx', import.meta.url),
  'utf8',
);
const bench = await readFile(new URL('./Bench.tsx', import.meta.url), 'utf8');
const styles = await readFile(
  new URL('./Bench.module.css', import.meta.url),
  'utf8',
);
const data = await readFile(
  new URL('../conceptData.ts', import.meta.url),
  'utf8',
);

test('history uses plain archive copy and states its direction', () => {
  assert.match(data, /heading: 'Previous site history\.'/);
  assert.match(data, /description: 'Earlier versions, oldest to newest\.'/);
  assert.match(bench, /aria-label="Previous site history, oldest to newest"/);
});

test('history artifacts form a level, square gallery line', () => {
  assert.doesNotMatch(scene, /HISTORY_ARC/);
  assert.match(scene, /position: \[chipX, active \? 0\.16 : 0, 0\]/);
  assert.match(scene, /rotation: \[0, 0, 0\]/);
  assert.match(scene, /rotation=\{\[0, 0, 0\]\}/);
});

test('history camera is level and free of decorative roll', () => {
  assert.match(scene, /position: \[0, HISTORY_CAMERA_EYE, HISTORY_CAMERA_Z\]/);
  assert.match(scene, /look: HISTORY_CAMERA_EYE/);
  assert.match(scene, /history: \{[\s\S]*?roll: 0,/);
  assert.doesNotMatch(scene, /historyX/);
});

test('history archive rail uses one surface instead of a checkerboard', () => {
  assert.doesNotMatch(styles, /\.historyDetails li:nth-child\(even\)/);
  assert.match(
    styles,
    /\.historyDetails \.plateHeading \{[\s\S]*?border-bottom:/,
  );
});
