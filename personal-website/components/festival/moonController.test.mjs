import assert from 'node:assert/strict';
import test from 'node:test';

import { DESKTOP_BASE, routeLayout } from './scene/layout.ts';
import { createMoonController } from './scene/moonController.ts';
import { light } from './palette.ts';

const blog = () => routeLayout('/blog', DESKTOP_BASE, false, {});
const past = () => routeLayout('/past-experience', DESKTOP_BASE, false, {});
const home = () => routeLayout('/', DESKTOP_BASE, false, {});

/** Advances the controller frame by frame (60 Hz) for `seconds` from `ts`. */
function runFor(moon, ts, seconds) {
  let t = ts;

  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    t += 1 / 60;
    moon.update(t);
  }

  return t;
}

test('§4.1 mount: the disc fades in over 900 ms, the halo 150 ms later over 600', () => {
  const moon = createMoonController();

  moon.enter(blog(), 10);
  assert.equal(moon.state.visible, true);
  assert.deepEqual(moon.state.centre, { x: 1275, y: 185 });
  assert.equal(moon.state.diameter, 150);
  moon.update(10.45);
  assert.ok(moon.state.alpha > 0.4 && moon.state.alpha < 1);
  assert.ok(moon.state.haloAlpha > 0 && moon.state.haloAlpha < 0.18);
  moon.update(11);
  assert.equal(moon.state.alpha, 1);
  assert.equal(moon.state.haloAlpha, light.moon.halo.peakDark);
});

test('§4.2 route: the moon glides to the new anchor over 600 ms, monotonic; fades out over 280 without one', () => {
  const moon = createMoonController();

  moon.enter(blog(), 0);
  runFor(moon, 0, 1);
  moon.enter(past(), 1);

  let lastX = moon.state.centre.x;

  for (let i = 1; i <= 36; i += 1) {
    moon.update(1 + i / 60);
    assert.ok(moon.state.centre.x >= lastX, 'x moves one way');
    lastX = moon.state.centre.x;
  }
  assert.deepEqual(moon.state.centre, { x: 1355, y: 155 });
  assert.equal(moon.state.diameter, 130);

  moon.enter(home(), 2);
  moon.update(2.14);
  assert.ok(moon.state.alpha > 0 && moon.state.alpha < 1);
  moon.update(2.3);
  assert.equal(moon.state.visible, false);
});

test('§2.1 / §4.3 the day/night blend: a tween while the moon is up, a snap when it arrives fresh', () => {
  const moon = createMoonController();

  // Arriving on a light page from `/` (night 1 pinned there): the blend
  // must follow the route's target at once, not stay at 1.
  moon.setNight(1, 0);
  moon.setNight(0, 0);
  assert.equal(moon.night, 0, 'no disc up: snap');

  moon.enter(blog(), 0);
  runFor(moon, 0, 1);
  moon.setNight(1, 1);
  moon.update(1.45);
  assert.ok(moon.night > 0 && moon.night < 1, 'dusk tweens over 900 ms');
  moon.update(2);
  assert.equal(moon.night, 1);
  moon.setNight(0, 2);
  moon.update(2.25);
  assert.ok(moon.night > 0 && moon.night < 1, 'morning tweens over 500 ms');
  moon.update(2.6);
  assert.equal(moon.night, 0);
});

test('§0.16 scroll dim multiplies the alpha; §4.6 snap parks everything', () => {
  const moon = createMoonController();

  moon.enter(blog(), 0);
  runFor(moon, 0, 1);
  moon.setDim(0.6, 1, 400);
  moon.update(1.4);
  assert.ok(Math.abs(moon.state.alpha - 0.6) < 1e-6);
  moon.setDim(1, 1.4, 0);
  moon.update(1.41);
  assert.equal(moon.state.alpha, 1);

  moon.snap(past(), 0);
  assert.deepEqual(moon.state.centre, { x: 1355, y: 155 });
  assert.equal(moon.state.alpha, 1);
  assert.equal(moon.night, 0);
  moon.snap(home(), 1);
  assert.equal(moon.state.visible, false);
});

test('§8 glideCrosses: an exiting body on the glide path delays the glide', () => {
  const moon = createMoonController();
  const to = { x: 1355, y: 155 };

  assert.equal(
    moon.glideCrosses(to, 130, [{ x: 1365, y: 196, w: 60, h: 52 }], 40),
    false,
    'no disc up: nothing to cross',
  );
  moon.enter(blog(), 0);
  runFor(moon, 0, 1);
  // /blog's lantern C (x1365–1425, y196–248) sits under the glide's end.
  assert.equal(
    moon.glideCrosses(to, 130, [{ x: 1365, y: 196, w: 60, h: 52 }], 40),
    true,
  );
  // /blog's lantern A (x52–140) is nowhere near it.
  assert.equal(
    moon.glideCrosses(to, 130, [{ x: 52, y: 118, w: 88, h: 76 }], 40),
    false,
  );
});
