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
