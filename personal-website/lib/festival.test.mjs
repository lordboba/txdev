import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COLOPHON_FALLBACK,
  FESTIVAL_ROUTES,
  MOBILE_MAX_WIDTH,
  colophonDate,
  festival,
  festivalRoute,
  formatChineseDate,
  hanDay,
  isFestivalEnabledOnServer,
  isFestivalRoute,
  isMobileWidth,
  isWithinFestivalWindow,
  localDateKey,
  parseFestivalOverride,
  parseFestivalSeed,
  parseLocalDate,
  readStoredOverride,
  resolveFestivalGate,
} from './festival.ts';

test('the colophon is 丙午年八月十五 from the ICU chinese calendar (§6.A1)', () => {
  const night = parseLocalDate(festival.date);

  assert.equal(formatChineseDate(night, 'Hans'), '丙午年八月十五');
  assert.equal(formatChineseDate(night, 'Hant'), '丙午年八月十五');
  assert.equal(colophonDate(), COLOPHON_FALLBACK);
  assert.equal(
    colophonDate({ ...festival, script: 'Hant' }),
    COLOPHON_FALLBACK,
  );
});

test('hanDay writes the strip-dating convention for 1–30', () => {
  assert.equal(hanDay(1), '一');
  assert.equal(hanDay(10), '十');
  assert.equal(hanDay(11), '十一');
  assert.equal(hanDay(15), '十五');
  assert.equal(hanDay(20), '二十');
  assert.equal(hanDay(21), '廿一');
  assert.equal(hanDay(29), '廿九');
  assert.equal(hanDay(30), '三十');
  assert.throws(() => hanDay(0), RangeError);
  assert.throws(() => hanDay(31), RangeError);
});

test('the window is an inclusive local-calendar range', () => {
  assert.equal(festival.window.start, '2026-09-21');
  assert.equal(festival.window.end, '2026-10-04');
  assert.equal(isWithinFestivalWindow(new Date(2026, 8, 20, 23, 59)), false);
  assert.equal(isWithinFestivalWindow(new Date(2026, 8, 21, 0, 0)), true);
  assert.equal(isWithinFestivalWindow(new Date(2026, 8, 25, 12)), true);
  assert.equal(isWithinFestivalWindow(new Date(2026, 9, 4, 23, 59)), true);
  assert.equal(isWithinFestivalWindow(new Date(2026, 9, 5, 0, 0)), false);
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('the server flag honours enabled and NEXT_PUBLIC_FESTIVAL=0', () => {
  assert.equal(isFestivalEnabledOnServer({}), true);
  assert.equal(isFestivalEnabledOnServer({ NEXT_PUBLIC_FESTIVAL: '0' }), false);
  assert.equal(isFestivalEnabledOnServer({ NEXT_PUBLIC_FESTIVAL: '1' }), true);
  assert.equal(
    isFestivalEnabledOnServer({}, { ...festival, enabled: false }),
    false,
  );
});

test('query parsing: ?festival=0|1 and ?festival-seed=<n>', () => {
  assert.equal(parseFestivalOverride('?festival=1'), true);
  assert.equal(parseFestivalOverride('festival=0'), false);
  assert.equal(parseFestivalOverride('?festival=yes'), null);
  assert.equal(parseFestivalOverride(''), null);
  assert.equal(parseFestivalOverride(null), null);
  assert.equal(parseFestivalSeed('?festival-seed=7'), 7);
  assert.equal(parseFestivalSeed('?festival=1&festival-seed=42'), 42);
  assert.equal(parseFestivalSeed('?festival-seed=-1'), null);
  assert.equal(parseFestivalSeed('?festival-seed=abc'), null);
  assert.equal(parseFestivalSeed('?bench-debug=1'), null);
  assert.equal(parseFestivalSeed(new URLSearchParams('festival-seed=3')), 3);
});

test('stored override reads 0/1 and tolerates a broken storage', () => {
  const storage = (value) => ({ getItem: () => value });

  assert.equal(readStoredOverride(storage('1')), true);
  assert.equal(readStoredOverride(storage('0')), false);
  assert.equal(readStoredOverride(storage(null)), null);
  assert.equal(readStoredOverride(null), null);
  assert.equal(
    readStoredOverride({
      getItem() {
        throw new Error('blocked');
      },
    }),
    null,
  );
});

test('the client gate: flag > query > storage > window', () => {
  const inWindow = new Date(2026, 8, 25);
  const afterWindow = new Date(2026, 9, 10);

  assert.deepEqual(resolveFestivalGate({ now: inWindow }), {
    active: true,
    reason: 'window',
    persist: null,
    seed: null,
  });
  assert.equal(resolveFestivalGate({ now: afterWindow }).active, false);
  assert.deepEqual(
    resolveFestivalGate({
      search: '?festival=1&festival-seed=7',
      now: afterWindow,
    }),
    { active: true, reason: 'query', persist: true, seed: 7 },
  );
  assert.deepEqual(
    resolveFestivalGate({ search: '?festival=0', now: inWindow }),
    {
      active: false,
      reason: 'query',
      persist: false,
      seed: null,
    },
  );
  assert.equal(
    resolveFestivalGate({ storedOverride: true, now: afterWindow }).reason,
    'storage',
  );
  assert.equal(
    resolveFestivalGate({
      search: '?festival=1',
      now: inWindow,
      config: { ...festival, enabled: false },
    }).active,
    false,
  );
});

test('the route allow-list (§7.2)', () => {
  assert.deepEqual(FESTIVAL_ROUTES, [
    '/',
    '/orbital',
    '/blog',
    '/blog/[slug]',
    '/past-experience',
    '/schedule-a-call',
  ]);
  assert.equal(festivalRoute('/'), '/');
  assert.equal(festivalRoute('/blog/'), '/blog');
  assert.equal(festivalRoute('/blog/introduction'), '/blog/[slug]');
  assert.equal(festivalRoute('/blog/introduction/'), '/blog/[slug]');
  assert.equal(festivalRoute('/blog/a/b'), null);
  assert.equal(festivalRoute('/past-experience?x=1'), '/past-experience');
  assert.equal(festivalRoute('/schedule-a-call'), '/schedule-a-call');
  assert.equal(festivalRoute('/orbital'), '/orbital');
  for (const off of ['/terminal', '/journey', '/concept/bench', '/nope', '']) {
    assert.equal(isFestivalRoute(off), false, `${off} is off`);
  }
});

test('mobile threshold matches the Bench (700 px)', () => {
  assert.equal(MOBILE_MAX_WIDTH, 700);
  assert.equal(isMobileWidth(700), true);
  assert.equal(isMobileWidth(701), false);
  assert.equal(isMobileWidth(390), true);
});
