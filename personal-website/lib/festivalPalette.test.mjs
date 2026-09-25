import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCENT_HUE_GATE,
  accentPassesHueGate,
  accentTints,
  contrastRatio,
  coolTowardMoon,
  hexToOklch,
  hexToRgb01,
  hexToRgb255,
  mixHex,
  palette,
  paperTints,
  relativeLuminance,
  rgb01ToHex,
  siteTokens,
} from '../components/festival/palette.ts';

/** Measured hues of the live `--accent` values in app/globals.css (§2.1). */
const MEASURED = [
  ['default', '#c89b52', 77.8, true],
  ['default light', '#a57b37', 76.9, true],
  ['ember', '#e8a060', 61.2, true],
  ['ember light', '#b86a1e', 59.0, true],
  ['ice', '#5090e0', 255, false],
  ['ice light', '#2862b0', 257, false],
  ['terminal', '#80e840', 136, false],
  ['terminal light', '#288c12', 141, false],
];

test('the OKLCH hue gate is [55°, 95°] and matches the measured accents', () => {
  assert.deepEqual(ACCENT_HUE_GATE, [55, 95]);

  for (const [name, hex, hue, passes] of MEASURED) {
    const measured = hexToOklch(hex).h;

    assert.ok(
      Math.abs(measured - hue) < 0.6,
      `${name} hue ${measured} ≈ ${hue}`,
    );
    assert.equal(accentPassesHueGate(hex), passes, `${name} gate`);
  }
});

test('mono keeps the amber accent, so it passes; ice and terminal fall back', () => {
  const amber = accentTints(siteTokens.accent.dark);
  const ice = accentTints('#5090e0');
  const terminal = accentTints('#80e840');

  assert.equal(amber.passed, true);
  assert.notEqual(amber.pool, palette.paperMid);
  assert.equal(
    amber.pool,
    mixHex(palette.paperMid, siteTokens.accent.dark, 0.2),
  );
  assert.equal(
    amber.halo,
    mixHex(palette.paperCore, siteTokens.accent.dark, 0.15),
  );

  for (const tints of [ice, terminal]) {
    assert.equal(tints.passed, false);
    assert.equal(tints.pool, palette.paperMid);
    assert.equal(tints.halo, palette.paperCore);
  }
  assert.ok(!('seal' in ice), 'the seal is not a tint: it is 银朱 ink');
});

test('§2.3 florets take the colour of the nearer light: warm beside a lantern, frosted beside the moon', () => {
  const gold = hexToRgb01(palette.floretGold);
  const nearLantern = coolTowardMoon(gold, 1200, 50);
  const nearMoon = coolTowardMoon(gold, 50, 1200);
  const frost = hexToRgb01(palette.frost);

  assert.deepEqual(nearLantern, gold, '50 px from a lantern stays warm');
  assert.ok(nearMoon[2] > gold[2] + 0.2, 'beside the moon it cools');
  assert.ok(
    Math.abs(nearMoon[2] - (gold[2] + (frost[2] - gold[2]) * 0.45)) < 1e-9,
    'full cool = 45% toward frost',
  );
  assert.deepEqual(coolTowardMoon(gold, null, 50), gold, 'no moon → warm');
});

test('luminance order: moon > paper core > paper mid > accent (§2.1)', () => {
  const Y = (hex) => relativeLuminance(hex);

  assert.ok(Y(palette.moonBody) > Y(palette.paperCore));
  assert.ok(Y(palette.paperCore) > Y(palette.paperMid));
  assert.ok(Y(palette.paperMid) > Y(siteTokens.accent.dark));
  assert.ok(contrastRatio(palette.ink.primary, palette.slipPaper) >= 7);
  assert.ok(
    contrastRatio(palette.ink.secondary, palette.slipPaper) >= 7,
    'the slip index ink also clears 7:1',
  );
});

test('hex helpers round-trip and the paper tints differ', () => {
  assert.deepEqual(hexToRgb255('#ffb61e'), [255, 182, 30]);
  assert.deepEqual(
    hexToRgb01('#000000').map((c) => c.toFixed(2)),
    ['0.00', '0.00', '0.00'],
  );
  assert.equal(rgb01ToHex(hexToRgb01('#c89b52')), '#c89b52');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(new Set(paperTints).size, 3);
  assert.throws(() => hexToRgb255('#fff'), RangeError);
});
