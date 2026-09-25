import assert from 'node:assert/strict';
import test from 'node:test';

import { accentTints, palette, siteTokens } from './palette.ts';
import { createThemeSampler } from './scene/themeSampler.ts';

function harness({ dark = true, accent = siteTokens.accent.dark } = {}) {
  const io = {
    dark,
    accent,
    tints: [],
    isDark() {
      return this.dark;
    },
    readAccent() {
      return this.accent;
    },
    onTints(t) {
      this.tints.push(t);
    },
  };

  return { io, theme: createThemeSampler(io) };
}

test('night target: 1 on dark or a theme-ignoring route, 0 on light; damped λ 8', () => {
  const { io, theme } = harness();

  theme.sample(false, null);
  theme.snap();
  assert.equal(theme.nightTarget, 1);
  assert.equal(theme.night, 1);

  io.dark = false;
  assert.equal(theme.changed(), true);
  assert.deepEqual(theme.sample(false, 5), { nightChanged: true });
  assert.equal(theme.nightTarget, 0);
  assert.equal(theme.changed(), false);
  theme.advance(1 / 60, 5.0167);
  assert.ok(theme.night < 1 && theme.night > 0.85, 'one frame of λ 8');
  for (let i = 0; i < 60; i += 1) theme.advance(1 / 60, 5.02 + i / 60);
  assert.equal(theme.night, 0, 'settled within a second');

  // `/` ignores the theme.
  assert.deepEqual(theme.sample(true, 6), { nightChanged: true });
  assert.equal(theme.nightTarget, 1);
});

test('the hue gate: amber accents tint the pool, ice / terminal fall back to paper; damped over 300 ms', () => {
  const { io, theme } = harness();

  theme.sample(false, null);
  assert.deepEqual(theme.tints, accentTints(siteTokens.accent.dark));
  assert.equal(theme.tints.passed, true);
  assert.equal(io.tints.length, 1);

  io.accent = '#5090e0'; // ice, 255°
  theme.sample(false, 1);
  assert.equal(io.tints.at(-1).pool, palette.paperMid);
  assert.equal(io.tints.at(-1).passed, false);
  theme.advance(1 / 60, 1.15);
  assert.notEqual(theme.tints.pool, palette.paperMid, 'mid-tween');
  theme.advance(1 / 60, 1.4);
  assert.equal(theme.tints.pool, palette.paperMid);
  assert.equal(theme.tints.halo, palette.paperCore);

  io.accent = '#e8a060'; // ember, 61°
  theme.sample(false, 2);
  theme.snap();
  assert.deepEqual(theme.tints, accentTints('#e8a060'));
  assert.equal(theme.tints.passed, true);
});
