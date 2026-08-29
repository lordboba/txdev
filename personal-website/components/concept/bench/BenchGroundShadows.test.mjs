import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./BenchScene.tsx', import.meta.url),
  'utf8',
);

test('contact shadows render once at the final pose instead of during motion', () => {
  assert.match(source, /const frames = settled \? 1 : 0;/);
  assert.doesNotMatch(source, /settled \? 1 : Infinity/);
});

test('the contact-shadow target stays bounded on desktop and mobile', () => {
  assert.match(source, /resolution=\{mobile \? 256 : 512\}/);
});
