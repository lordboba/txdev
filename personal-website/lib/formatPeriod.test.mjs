import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPeriod } from './formatPeriod.ts';
import { experiences } from '../content/experienceData.ts';
import { journeyBeats } from '../content/journeyData.ts';

/** A period that opens with a year or a month abbreviation is a date. */
const DATE_LEAD =
  /^(\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4})/;
const RENDERED_RANGE =
  /^((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) )?\d{4}(–((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) )?(\d{4}|Present))?$|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)–(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

test('formatPeriod writes one range convention', () => {
  assert.equal(formatPeriod('Jun 2025', 'Sep 2025'), 'Jun–Sep 2025');
  assert.equal(formatPeriod('Nov 2024', 'May 2025'), 'Nov 2024–May 2025');
  assert.equal(formatPeriod('May 2025', 'Present'), 'May 2025–Present');
  assert.equal(formatPeriod('Sep 2026', 'Sep 2026'), 'Sep 2026');
  assert.equal(formatPeriod('2025', '2025'), '2025');
  assert.equal(formatPeriod('2022', '2023'), '2022–2023');
  assert.equal(formatPeriod('2024', 'Present'), '2024–Present');
  assert.equal(formatPeriod('Nov 2024', '2025'), 'Nov 2024–2025');
});

test('formatPeriod rejects input it cannot read as a date', () => {
  for (const [start, end] of [
    ['Summer 2026', 'Present'],
    ['', 'Present'],
    ['Jun 2025', ''],
    ['Jun 2025', 'Fall 2025'],
    ['June 2025', 'Sep 2025'],
    ['Jun 25', 'Sep 2025'],
    ['Present', 'Present'],
    ['Jun 2025', 'present'],
  ]) {
    assert.throws(
      () => formatPeriod(start, end),
      RangeError,
      `${JSON.stringify(start)} → ${JSON.stringify(end)}`,
    );
  }
});

test('formatPeriod never uses spaces around the dash or the word "to"', () => {
  for (const value of [
    formatPeriod('Jun 2025', 'Sep 2025'),
    formatPeriod('May 2025', 'Present'),
    formatPeriod('2022', '2023'),
  ]) {
    assert.doesNotMatch(value, / to |\s–|–\s/);
  }
});

test('experience periods are derived from start/end in the shared convention', () => {
  const expected = {
    'Decagon AI': 'Sep–Dec 2026',
    Ramp: 'Jun–Sep 2026',
    SafetyKit: 'Jun–Sep 2025',
    'Upsilon Pi Epsilon @ UCLA': 'May 2025–Present',
    'Scale AI': 'Nov 2024–May 2025',
  };

  for (const experience of experiences) {
    assert.equal(
      experience.period,
      expected[experience.company],
      `${experience.company} period`,
    );
  }
});

test('journey periods that read as dates follow the convention', () => {
  for (const beat of journeyBeats) {
    assert.doesNotMatch(beat.period, / to /i, `${beat.id} period`);

    if (DATE_LEAD.test(beat.period)) {
      assert.match(beat.period, RENDERED_RANGE, `${beat.id} period`);
    }
  }
});
