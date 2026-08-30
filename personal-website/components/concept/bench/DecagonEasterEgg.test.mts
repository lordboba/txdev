import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { conceptViews } from '../conceptData.ts';
import {
  companyRun,
  companyTags,
  experiences,
} from '../../../content/experienceData.ts';

const benchSceneSource = readFileSync(
  fileURLToPath(new URL('./BenchScene.tsx', import.meta.url)),
  'utf8',
);
const homePageSource = readFileSync(
  fileURLToPath(new URL('../../../app/page.tsx', import.meta.url)),
  'utf8',
);
const logoManifest = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../public/logos/manifest.json', import.meta.url),
    ),
    'utf8',
  ),
) as { company: string; file: string; source_url: string }[];

test('Decagon is accurate in site data but only a logo easter egg on the homepage', () => {
  const decagon = experiences.find((entry) => entry.company === 'Decagon AI');

  assert.ok(decagon);
  assert.equal(decagon.status, 'upcoming');
  assert.equal(decagon.start, 'Sep 2026');
  assert.equal(decagon.end, 'Dec 2026');
  assert.equal(
    experiences.some((entry) => entry.company === 'Snowflake'),
    false,
  );

  const visibleEmployerCopy = [
    conceptViews.find((view) => view.id === 'work')?.description ?? '',
    ...companyRun.flatMap((entry) => [
      entry.company,
      entry.period,
      entry.detail,
    ]),
    ...companyTags.flatMap((tag) => [
      tag.mark,
      tag.org,
      tag.role,
      tag.period,
      tag.run ?? '',
      tag.detail ?? '',
      tag.summary,
      tag.proof,
      ...tag.focus,
    ]),
    homePageSource,
  ].join('\n');

  assert.doesNotMatch(visibleEmployerCopy, /Snowflake|Decagon/i);
  assert.doesNotMatch(benchSceneSource, /Snowflake/);
  assert.match(
    benchSceneSource,
    /Decagon: \{ file: 'decagon\.svg', aspect: 147 \/ 32 \}/,
  );
  assert.match(benchSceneSource, /company="Decagon"/);

  const decagonLogo = logoManifest.find((entry) => entry.company === 'Decagon');
  assert.ok(decagonLogo);
  assert.equal(decagonLogo.file, 'decagon.svg');
  assert.equal(decagonLogo.source_url, 'https://decagon.ai/');
});
