import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DESKTOP_BASE,
  MOBILE_BASE,
  cameraZ,
  cordClearsMoon,
  pxToWorld,
  routeLayout,
  worldToPx,
} from '../components/festival/scene/layout.ts';

const desktop = (path, live = {}) =>
  routeLayout(path, DESKTOP_BASE, false, live);
const mobile = (path) => routeLayout(path, MOBILE_BASE, true, {});
const span = (r) => [r.x, r.x + r.w, r.y, r.y + r.h];
const lantern = (layout, id) => layout.lanterns.find((l) => l.id === id);

test('§3.8 counts and sizes at a glance (desktop, 1440×900)', () => {
  const expect = {
    '/': {
      lanterns: ['A:72', 'B:44'],
      moon: null,
      florets: 24,
      slip: false,
      z: 2,
    },
    '/orbital': {
      lanterns: ['C:64', 'A:56'],
      moon: 120,
      florets: 30,
      slip: false,
      z: 2,
    },
    '/blog': {
      lanterns: ['A:88', 'B:56', 'C:60'],
      moon: 150,
      florets: 36,
      slip: true,
      z: 1,
    },
    '/blog/introduction': {
      lanterns: ['A:88', 'B:56', 'C:60'],
      moon: 150,
      florets: 36,
      slip: false,
      z: 1,
    },
    '/past-experience': {
      lanterns: ['A:72', 'B:52'],
      moon: 130,
      florets: 30,
      slip: true,
      z: 1,
    },
    '/schedule-a-call': {
      lanterns: ['A:88', 'B:56', 'C:56'],
      moon: 130,
      florets: 30,
      slip: true,
      z: 1,
    },
  };

  for (const [path, row] of Object.entries(expect)) {
    const layout = desktop(path);

    assert.deepEqual(
      layout.lanterns.map((l) => `${l.id}:${l.body}`),
      row.lanterns,
      `${path} lanterns`,
    );
    assert.equal(layout.moon?.diameter ?? null, row.moon, `${path} moon`);
    assert.equal(layout.florets.count, row.florets, `${path} florets`);
    assert.equal(
      layout.lanterns.some((l) => l.slip),
      row.slip,
      `${path} slip`,
    );
    assert.equal(layout.zIndex, row.z, `${path} z`);
    assert.equal(
      layout.lanterns.filter((l) => l.hero).length,
      1,
      `${path} one hero`,
    );
    assert.equal(layout.lanterns[0].hero, true, `${path} hero lowers first`);
    assert.ok(layout.lanterns.length <= 3, `${path} ≤ 3 lanterns`);
    assert.ok(layout.florets.count <= 36, `${path} ≤ 36 florets`);
    for (const l of layout.lanterns)
      assert.ok(cordClearsMoon(l, layout.moon), `${path} ${l.id} cord`);
    const periods = layout.lanterns.map((l) => l.period);
    for (let i = 0; i < periods.length; i++)
      for (let j = i + 1; j < periods.length; j++)
        assert.ok(
          Math.abs(periods[i] - periods[j]) / periods[i] > 0.08,
          `${path} periods differ`,
        );
  }
});

test('§3.1 `/`: bodies, cords from the lintel, colophon, no halo, pool 0.10', () => {
  const layout = desktop('/');

  assert.deepEqual(span(lantern(layout, 'A').bodyRect), [1264, 1336, 120, 182]);
  assert.deepEqual(span(lantern(layout, 'B').bodyRect), [1378, 1422, 104, 142]);
  assert.equal(lantern(layout, 'A').cordAnchorY, 64);
  assert.equal(lantern(layout, 'A').period, 2.8);
  assert.equal(lantern(layout, 'B').period, 2.1);
  assert.deepEqual(span(layout.text.colophon), [1215, 1420, 252, 264]);
  assert.equal(layout.text.colophonOrientation, 'horizontal');
  assert.equal(layout.text.poem, null);
  assert.deepEqual(span(layout.florets.emitters[0]), [480, 1440, 64, 330]);
  assert.deepEqual(layout.florets.alphaRampY, [280, 330]);
  assert.equal(layout.florets.alphaMax, 0.6);
  assert.equal(layout.halo, false);
  assert.equal(layout.poolPeak, 0.1);
  assert.equal(layout.ignoresTheme, true);
});

test('§3.2 `/orbital`: hero C from the tools pill, moon left, left-aligned lockup', () => {
  const layout = desktop('/orbital');

  assert.deepEqual(span(lantern(layout, 'C').bodyRect), [1298, 1362, 120, 175]);
  assert.equal(lantern(layout, 'C').cordAnchorY, 66);
  assert.deepEqual(span(lantern(layout, 'A').bodyRect), [272, 328, 66, 114]);
  assert.deepEqual(layout.moon, { centre: { x: 160, y: 100 }, diameter: 120 });
  assert.deepEqual(span(layout.text.poem), [128, 150, 176, 302]);
  assert.deepEqual(span(layout.text.colophon), [106, 118, 176, 272]);
  assert.deepEqual(span(layout.text.translation), [128, 358, 314, 330]);
  assert.equal(layout.text.translationAlign, 'left');

  const live = desktop('/orbital', {
    elements: {
      '.orb-hero-tools': { left: 985, top: 28, right: 1412, bottom: 70 },
    },
  });
  assert.equal(lantern(live, 'C').cordAnchorY, 70);
});

test('§3.3 `/blog`: three lanterns, slip on B, moon anchor (1275, 185, 150)', () => {
  const layout = desktop('/blog');

  assert.deepEqual(span(lantern(layout, 'A').bodyRect), [52, 140, 118, 194]);
  assert.deepEqual(span(lantern(layout, 'B').bodyRect), [186, 242, 176, 224]);
  assert.deepEqual(span(lantern(layout, 'B').slipRect), [195, 233, 238, 390]);
  assert.deepEqual(span(lantern(layout, 'C').bodyRect), [1365, 1425, 196, 248]);
  assert.deepEqual(layout.moon, { centre: { x: 1275, y: 185 }, diameter: 150 });
  assert.deepEqual(span(layout.text.poem), [1178, 1200, 276, 402]);
  assert.deepEqual(span(layout.text.colophon), [1160, 1172, 276, 372]);
  assert.deepEqual(span(layout.text.translation), [1190, 1420, 412, 429]);
  assert.equal(layout.navBottom, 75);
  assert.equal(layout.riddlePool, 'post');
  assert.deepEqual(layout.florets.emitters.map(span), [
    [0, 304, 75, 900],
    [1136, 1440, 75, 900],
    [304, 1136, 75, 150],
  ]);
});

test('§3.4 `/blog/[slug]`: same shell, no slip, moon dims on scroll', () => {
  const layout = desktop('/blog/introduction');

  assert.equal(lantern(layout, 'B').slip, false);
  assert.equal(lantern(layout, 'B').slipRect, null);
  assert.deepEqual(layout.moonScrollDim, {
    afterScrollY: 400,
    to: 0.6,
    ms: 400,
  });
  assert.equal(layout.riddlePool, null);
});

test('§3.5 `/past-experience`: two lanterns, B flush at x176, no C', () => {
  const layout = desktop('/past-experience');

  assert.deepEqual(span(lantern(layout, 'A').bodyRect), [28, 100, 112, 174]);
  assert.deepEqual(span(lantern(layout, 'B').bodyRect), [124, 176, 210, 255]);
  assert.equal(lantern(layout, 'C'), undefined);
  assert.deepEqual(layout.moon, { centre: { x: 1355, y: 155 }, diameter: 130 });
  assert.deepEqual(span(layout.text.poem), [1272, 1294, 240, 366]);
  assert.deepEqual(span(layout.text.colophon), [1254, 1266, 240, 336]);
  assert.deepEqual(span(layout.text.translation), [1190, 1420, 378, 395]);
  assert.equal(layout.navBottom, 131);
  assert.equal(layout.routeSeed, 0);
  assert.deepEqual(layout.florets.emitters.map(span), [
    [0, 176, 0, 900],
    [1264, 1440, 0, 900],
  ]);

  const pinned = desktop('/past-experience', {
    nav: { left: 176, top: 0, right: 1264, bottom: 75 },
  });
  assert.equal(pinned.navBottom, 75);
});

test('§3.6 `/schedule-a-call`: C 30 px clear of the moon, feather 24, seed 5', () => {
  const layout = desktop('/schedule-a-call');

  assert.deepEqual(span(lantern(layout, 'A').bodyRect), [48, 136, 112, 188]);
  assert.deepEqual(span(lantern(layout, 'B').bodyRect), [168, 224, 196, 244]);
  assert.deepEqual(span(lantern(layout, 'B').slipRect), [177, 215, 258, 410]);
  assert.deepEqual(span(lantern(layout, 'C').bodyRect), [1382, 1438, 240, 288]);
  assert.deepEqual(layout.moon, { centre: { x: 1315, y: 155 }, diameter: 130 });
  assert.deepEqual(span(layout.text.poem), [1228, 1250, 240, 366]);
  assert.deepEqual(span(layout.text.colophon), [1210, 1222, 240, 336]);
  assert.equal(layout.florets.featherPx, 24);
  assert.equal(layout.routeSeed, 5);
  assert.deepEqual(layout.florets.emitters.map(span), [
    [0, 232, 0, 900],
    [1208, 1440, 0, 900],
  ]);
  assert.deepEqual(span(layout.florets.exclusions[0]), [241, 1199, 582, 1342]);
});

test('mobile 390×844: florets only, one lantern on /blog*, nothing on the inset routes', () => {
  assert.deepEqual(mobile('/').lanterns, []);
  assert.equal(mobile('/').florets.count, 10);
  assert.equal(mobile('/').florets.trackSelector, 'main canvas');
  assert.equal(mobile('/').zIndex, 1);
  assert.equal(mobile('/orbital').florets.count, 12);
  assert.equal(mobile('/orbital').moon, null);

  const blog = mobile('/blog');
  assert.equal(blog.lanterns.length, 1);
  assert.equal(blog.lanterns[0].hero, false);
  assert.deepEqual(span(blog.lanterns[0].bodyRect), [313, 357, 74, 112]);
  assert.equal(blog.lanterns[0].cordAnchorY, 62);
  assert.equal(blog.florets.count, 12);
  assert.equal(blog.moon, null);
  assert.equal(blog.text.poem, null);
  assert.deepEqual(blog.scrollLift, {
    liftAtScrollY: 120,
    returnBelowScrollY: 40,
    px: 24,
    ms: 260,
  });

  for (const path of ['/past-experience', '/schedule-a-call']) {
    const layout = mobile(path);
    assert.deepEqual(layout.lanterns, []);
    assert.equal(layout.florets.count, 0);
    assert.equal(layout.moon, null);
  }
});

test('gutters anchor to the container edge; objects that do not fit are dropped', () => {
  const wide = routeLayout('/blog', { w: 1920, h: 900 }, false, {});
  // Container 832 wide, centred: left edge 544; A keeps its 208 px offset.
  assert.equal(lantern(wide, 'A').bodyRect.x, 544 - 252);
  assert.equal(wide.moon.centre.x, 1376 + 139);

  const narrow = routeLayout('/blog', { w: 1280, h: 900 }, false, {});
  assert.ok(
    lantern(narrow, 'A').bodyRect.x >= 2,
    'hero clamped into the viewport',
  );
  assert.equal(
    lantern(narrow, 'C'),
    undefined,
    'C would cross the moon: dropped',
  );

  const orbitalNarrow = routeLayout('/orbital', { w: 1280, h: 900 }, false, {});
  assert.equal(
    lantern(orbitalNarrow, 'A'),
    undefined,
    'A would touch the H1: dropped',
  );
  assert.equal(routeLayout('/terminal', DESKTOP_BASE), null);
});

test('px ↔ world: 100 px per unit at z 0, camera z 16.79 at 900 px tall', () => {
  assert.ok(Math.abs(cameraZ(900) - 16.79) < 0.01);
  assert.deepEqual(pxToWorld({ x: 720, y: 450 }, DESKTOP_BASE), {
    x: 0,
    y: 0,
    z: 0,
  });
  assert.deepEqual(pxToWorld({ x: 820, y: 350 }, DESKTOP_BASE), {
    x: 1,
    y: 1,
    z: 0,
  });

  const far = pxToWorld({ x: 0, y: 0 }, DESKTOP_BASE, -3);
  const back = worldToPx(far, DESKTOP_BASE);
  assert.ok(Math.abs(back.x) < 1e-9 && Math.abs(back.y) < 1e-9);
  assert.ok(far.x < -7.2, 'further away covers more world per px');
});
