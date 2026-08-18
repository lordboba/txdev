import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./Bench.tsx', import.meta.url), 'utf8');

test('profile destinations render as labelled icon cards', () => {
  for (const icon of [
    'FileText',
    'LinkedinLogo',
    'GithubLogo',
    'PhoneCall',
    'EnvelopeSimple',
  ]) {
    assert.match(source, new RegExp(`icon: ${icon}`));
  }

  assert.match(source, /className=\{styles\.profileLinkCard\}/);
  assert.match(source, /className=\{styles\.profileLinkLabel\}/);
  assert.match(source, /aria-hidden="true"/);
});

test('side project gallery uses direct, personal copy', () => {
  assert.match(source, /More things I’ve built\./);
  assert.match(
    source,
    /Games, bots, benchmarks, and small tools\. Open any project for the repo or live version\./,
  );
  assert.match(source, /Choose a project for details\./);
  assert.doesNotMatch(source, /The rest of the shelf\./);
  assert.doesNotMatch(source, /Pick a piece to read its label\./);
});
