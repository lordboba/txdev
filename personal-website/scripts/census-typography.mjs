/**
 * Typography census — computed-style assertions for the site's type system
 * (docs/mid-autumn/ART_DIRECTION.md §6.B, §7.7 T1).
 *
 * Usage:
 *   node scripts/census-typography.mjs --base http://localhost:3000 [--out ./shots/census]
 *
 * Requires a cached Playwright Chromium build and `playwright-core`, which is
 * not a project dependency: point PLAYWRIGHT_CORE at a directory whose
 * node_modules contains it (defaults to the current working directory).
 *
 * Asserts, on every route that has one:
 *   - every <h1> resolves to Cormorant Garamond (the family utilities used to
 *     compile to `font-weight: var(--font-display)` and were dropped);
 *   - every eyebrow resolves to IBM Plex Mono at 10px / 0.10em;
 *   - the blog reading column measures <= 66ch, a post has exactly one <h1>,
 *     and its rendered HTML uses curly quotes.
 *
 * Exits 1 on any failure and writes census.json next to the screenshots.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(
  join(process.env.PLAYWRIGHT_CORE ?? process.cwd(), 'package.json'),
);
const { chromium } = require('playwright-core');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null))
    .filter(Boolean),
);
const base = (args.base ?? 'http://localhost:3000').replace(/\/$/, '');
const out = args.out ?? './shots/census';
mkdirSync(out, { recursive: true });

const cache = join(homedir(), 'Library/Caches/ms-playwright');
const build = readdirSync(cache)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .at(-1);
if (!build) {
  console.error(
    'No cached Chromium build; run: npx playwright-core install chromium',
  );
  process.exit(1);
}
const exe = join(
  cache,
  build,
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const ROUTES = [
  '/',
  '/blog',
  '/blog/introduction',
  '/past-experience',
  '/schedule-a-call',
  '/orbital',
  '/terminal',
];

/** Runs in the page: one JSON record per route. */
function census() {
  const first = (ff) =>
    ff
      .split(',')[0]
      .trim()
      .replace(/^["']|["']$/g, '');
  const cs = (el) => getComputedStyle(el);
  const text = (el) => (el.textContent || '').trim().slice(0, 40);

  const h1s = [...document.querySelectorAll('h1')].map((el) => {
    const s = cs(el);
    return {
      text: text(el),
      family: first(s.fontFamily),
      weight: s.fontWeight,
      size: s.fontSize,
      tracking: s.letterSpacing,
      lineHeight: s.lineHeight,
      numeric: s.fontVariantNumeric,
    };
  });

  const eyebrows = [...document.querySelectorAll('.eyebrow')].map((el) => {
    const s = cs(el);
    return {
      text: text(el),
      family: first(s.fontFamily),
      size: s.fontSize,
      tracking: s.letterSpacing,
      weight: s.fontWeight,
    };
  });

  let prose = null;
  const column = document.querySelector('.blog-prose');
  if (column) {
    const s = cs(column);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const zero = ctx.measureText('0').width;
    prose = {
      maxWidth: s.maxWidth,
      widthPx: column.getBoundingClientRect().width,
      widthCh: +(column.getBoundingClientRect().width / zero).toFixed(1),
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      textWrap: s.textWrap,
      h1Count: document.querySelectorAll('article h1').length,
      curlyQuotes: /[‘’“”]/.test(column.innerHTML),
    };
  }

  return { h1Count: h1s.length, h1s, eyebrows, prose };
}

const failures = [];
const expect = (ok, message) => {
  if (!ok) failures.push(message);
};

const browser = await chromium.launch({ executablePath: exe, headless: true });
const results = {};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  for (const route of ROUTES) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const record = await page.evaluate(census);
    results[route] = record;

    for (const h1 of record.h1s) {
      expect(
        h1.family === 'Cormorant Garamond',
        `${route}: h1 "${h1.text}" is ${h1.family}, expected Cormorant Garamond`,
      );
    }
    for (const eyebrow of record.eyebrows) {
      expect(
        eyebrow.family === 'IBM Plex Mono' &&
          eyebrow.size === '10px' &&
          eyebrow.tracking === '1px',
        `${route}: eyebrow "${eyebrow.text}" is ${eyebrow.family} ${eyebrow.size} / ${eyebrow.tracking}, expected IBM Plex Mono 10px / 1px`,
      );
    }
    if (record.prose) {
      expect(
        record.prose.widthCh <= 66.5,
        `${route}: reading column is ${record.prose.widthCh}ch, expected <= 66ch`,
      );
      expect(
        record.prose.h1Count === 1,
        `${route}: article has ${record.prose.h1Count} h1s, expected 1`,
      );
      expect(record.prose.curlyQuotes, `${route}: no curly quotes in prose`);
    }
  }
} finally {
  await browser.close();
}

writeFileSync(join(out, 'census.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (failures.length > 0) {
  console.error(`\n${failures.length} typography assertion(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nTypography census passed.');
