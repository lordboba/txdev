import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PALETTE_CSS_VARS,
  accentTints,
  palette,
  siteTokens,
} from '../components/festival/palette.ts';

const css = readFileSync('components/festival/festival.css', 'utf8');
const moduleCss = readFileSync(
  'components/festival/festival.module.css',
  'utf8',
);

/** The declarations inside the first `html[data-festival='mid-autumn'] { … }` block. */
function tokenBlock() {
  const match = /html\[data-festival='mid-autumn'\]\s*\{([^}]*)\}/.exec(css);

  assert.ok(match, 'festival.css declares html[data-festival="mid-autumn"]');

  return Object.fromEntries(
    match[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(';')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const colon = line.indexOf(':');

        return [
          line.slice(0, colon).trim(),
          line
            .slice(colon + 1)
            .replace(/\s+/g, ' ')
            .trim(),
        ];
      }),
  );
}

test('festival.css mirrors every PALETTE_CSS_VARS entry with its palette value', () => {
  const tokens = tokenBlock();
  const expected = {
    paperUnlit: palette.paperUnlit,
    paperMid: palette.paperMid,
    paperCore: palette.paperCore,
    moonRim: palette.moonRim,
    frost: palette.frost,
    nightNearMoon: palette.nightNearMoon,
    tassel: palette.tassel.from,
    knot: palette.knot,
    ink: palette.ink.primary,
    inkSecondary: palette.ink.secondary,
    slipPaper: palette.slipPaper,
    slipEdge: palette.slipEdge,
  };

  for (const [key, hex] of Object.entries(expected)) {
    const name = PALETTE_CSS_VARS[key];

    assert.equal(tokens[name], hex, `${name} should be ${hex}`);
  }

  // The runtime-resolved tints default to the site's own amber accent.
  const tints = accentTints(siteTokens.accent.dark);
  assert.equal(tints.passed, true);
  assert.equal(tokens[PALETTE_CSS_VARS.poolTint], tints.pool);
  assert.equal(tokens[PALETTE_CSS_VARS.haloTint], tints.halo);
  assert.equal(tokens[PALETTE_CSS_VARS.underline], 'var(--accent)');
  // The seal is 银朱 ink, never the accent (§5.4, §8).
  assert.match(
    moduleCss,
    /\.slipSeal\s*\{[^}]*background: var\(--festival-tassel\)/,
  );
  assert.ok(
    !/--festival-seal/.test(css + moduleCss),
    'no --festival-seal left',
  );

  // Every named var is declared, none is left out.
  for (const name of Object.values(PALETTE_CSS_VARS)) {
    assert.ok(name in tokens, `${name} declared`);
  }
});

test('festival.css carries the night flag and the sky-tint gradient rule', () => {
  const tokens = tokenBlock();

  assert.equal(tokens['--festival-night'], '1');
  assert.match(
    css,
    /html\[data-festival='mid-autumn'\]\[data-theme='light'\]\s*\{[^}]*--festival-night:\s*0/,
  );
  assert.match(css, /\.festival-sky\s*\{/);
  assert.match(
    css,
    /radial-gradient\(\s*circle at var\(--moon-x[^)]*\) var\(--moon-y/,
  );
  assert.match(
    css,
    /var\(--festival-night-near-moon\) var\(--festival-sky-alpha\)/,
  );
  assert.equal(tokens['--festival-sky-alpha'], '12%');
  assert.equal(tokens['--festival-sky-radius'], '1.1');
  assert.match(css, /opacity: var\(--festival-night, 1\)/);
});

test('festival.module.css sets the §6.A sizes', () => {
  const rule = (selector) => {
    const match = new RegExp(
      `${selector.replace(/[.[\]']/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    ).exec(moduleCss);

    assert.ok(match, `${selector} exists`);

    return match[1];
  };

  assert.match(rule('.strip'), /width: 38px/);
  assert.match(rule('.strip'), /height: 152px/);
  assert.match(rule('.strip'), /rgba\(255, 182, 30, 0\.22\), transparent 38%/);
  assert.match(rule('.slipTarget'), /font-size: 15px/);
  assert.match(rule('.slipTarget'), /letter-spacing: 0\.18em/);
  assert.match(rule('.slipSeal'), /width: 9px/);
  assert.match(rule('.card'), /max-width: 28ch/);
  // 28ch measures the card's own Cormorant italic, and the card hangs under the strip.
  assert.match(rule('.card'), /font-size: 19px/);
  assert.match(rule('.card'), /font-style: italic/);
  assert.match(rule('.card'), /top: calc\(100% \+ 8px\)/);
  // The slip is pinned with a transform, never left/top (no layout per frame).
  assert.match(rule('.slip'), /translate3d\(var\(--slip-x/);
  assert.match(rule('.slip'), /left: 0;/);
  assert.match(rule(".colophon[data-home='true']"), /0\.75\)/);
  assert.match(rule('.clue'), /font-size: 19px/);
  assert.match(rule('.answer'), /font-size: 17px/);
  assert.match(rule('.column'), /font-size: 22px/);
  assert.match(rule('.column'), /text-orientation: upright/);
  assert.match(rule('.glyph'), /display: inline-block/);
  assert.match(rule('.glyph'), /margin-inline-end: 0\.18em/);
  assert.match(rule('.translation'), /font-size: 17px/);
  assert.match(rule('.colophon'), /font-size: 11px/);
  assert.match(rule('.pull'), /margin: -3px -3px -8px/);
  assert.match(moduleCss, /animation: moon-name 1600ms/);
});
