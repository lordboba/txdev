import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSpine,
  cameraTransform,
  flyCamera,
  pointAtLength,
  project,
  unproject,
} from './routeGeometry.ts';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

test('the spine passes through every input point at its recorded length', () => {
  const spine = buildSpine(square);

  assert.equal(spine.pointLengths.length, square.length);
  assert.equal(spine.pointLengths[0], 0);
  assert.equal(spine.pointLengths.at(-1), spine.total);

  square.forEach((point, index) => {
    const at = pointAtLength(spine, spine.pointLengths[index]);
    assert.ok(
      Math.abs(at.x - point.x) < 1e-6 && Math.abs(at.y - point.y) < 1e-6,
    );
  });

  /* Lengths are monotonic, and a curved route is longer than the chords. */
  for (let i = 1; i < spine.pointLengths.length; i += 1) {
    assert.ok(spine.pointLengths[i] > spine.pointLengths[i - 1]);
  }
  assert.ok(spine.total > 300);
  assert.match(spine.d, /^M 0\.00 0\.00 C /);
});

test('pointAtLength clamps to the ends and interpolates between samples', () => {
  const spine = buildSpine(square);

  assert.deepEqual(pointAtLength(spine, -50), { x: 0, y: 0 });
  assert.deepEqual(pointAtLength(spine, spine.total + 50), { x: 0, y: 100 });

  const mid = pointAtLength(spine, spine.pointLengths[1] / 2);
  assert.ok(mid.x > 0 && mid.x < 100);

  assert.deepEqual(buildSpine([]), {
    d: '',
    samples: [],
    pointLengths: [],
    total: 0,
  });
});

test('project and unproject are inverses under any camera', () => {
  const camera = { cx: 120, cy: 380, w: 200 };
  const viewport = { width: 980, height: 850 };
  const point = { x: 99.7, y: 397.5 };

  const pixel = project(camera, viewport, point);
  const back = unproject(camera, viewport, pixel);

  assert.ok(Math.abs(back.x - point.x) < 1e-9);
  assert.ok(Math.abs(back.y - point.y) < 1e-9);

  /* The camera centre lands in the middle of the panel. */
  const centre = project(camera, viewport, { x: camera.cx, y: camera.cy });
  assert.deepEqual(centre, { x: 490, y: 425 });

  assert.equal(
    cameraTransform(camera, viewport),
    'translate(490.00 425.00) scale(4.90000) translate(-120.000 -380.000)',
  );
});

test('a camera flight starts and ends exactly on its framings and lifts between', () => {
  const from = { cx: 60, cy: 300, w: 260 };
  const to = { cx: 880, cy: 215, w: 220 };

  assert.deepEqual(flyCamera(from, to, 0), from);
  const end = flyCamera(from, to, 1);
  assert.ok(Math.abs(end.cx - to.cx) < 1e-9 && Math.abs(end.w - to.w) < 1e-9);

  const mid = flyCamera(from, to, 0.5);
  assert.ok(mid.w > Math.max(from.w, to.w), 'a long hop pulls the camera out');
  assert.ok(mid.w <= 1100, 'never wider than the whole atlas');

  const hop = flyCamera(from, { ...from, cx: 70 }, 0.5);
  assert.ok(hop.w - from.w < 10, 'a short hop barely lifts');
});
