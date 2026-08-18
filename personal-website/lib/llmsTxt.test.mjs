import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const llmsPath = new URL('../public/llms.txt', import.meta.url);

test('llms.txt follows the proposal and points to canonical public sources', async () => {
  const source = await readFile(llmsPath, 'utf8');

  assert.match(source, /^# Tyler Xiao\n\n> .+/);
  assert.match(source, /^## Portfolio$/m);
  assert.match(source, /^## Profiles$/m);
  assert.match(source, /^## Optional$/m);

  for (const url of [
    'https://tylerx.dev/',
    'https://tylerx.dev/past-experience',
    'https://tylerx.dev/blog',
    'https://tylerx.dev/resume/resume.pdf',
    'https://github.com/lordboba',
  ]) {
    assert.match(source, new RegExp(`\\(${url.replaceAll('.', '\\.')}`));
  }

  assert.doesNotMatch(source, /localhost|TEMPLATE|TODO/i);
});
