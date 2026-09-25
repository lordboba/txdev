import assert from 'node:assert/strict';
import test from 'node:test';

import { COLLAR_POINT_Y } from './scene/lantern.ts';
import { DESKTOP_BASE, pxToWorld, routeLayout } from './scene/layout.ts';
import { createSlipPinner, slipGapFor } from './scene/slipPin.ts';

const blog = () => routeLayout('/blog', DESKTOP_BASE, false, {});

test('§6.A3 the strip hangs at its layout rect when lantern B is plumb: the gap closes collar → strip top', () => {
  const layout = blog();
  const b = layout.lanterns.find((l) => l.id === 'B');
  const gap = slipGapFor(layout, COLLAR_POINT_Y);
  const restCollarY = b.bodyRect.y + b.bodyRect.h / 2 - COLLAR_POINT_Y * b.body;

  assert.ok(gap > 0);
  assert.equal(restCollarY + gap, b.slipRect.y);
  assert.equal(
    slipGapFor(
      routeLayout('/blog/introduction', DESKTOP_BASE, false, {}),
      COLLAR_POINT_Y,
    ),
    0,
    'no slip, no gap',
  );
});

test('§6.A3 the pin lands on the layout rect at rest, leans 0.8× θ, and damps toward a moved collar at λ 12', () => {
  const layout = blog();
  const b = layout.lanterns.find((l) => l.id === 'B');
  const pinner = createSlipPinner(COLLAR_POINT_Y);
  // The collar at rest, as lantern.ts would report it.
  const collarPx = {
    x: b.x,
    y: b.bodyRect.y + b.bodyRect.h / 2 - COLLAR_POINT_Y * b.body,
  };
  const collarPoint = (id, out) => {
    assert.equal(id, 'B');

    return pxToWorld(collarPx, DESKTOP_BASE, b.z, out);
  };
  const states = [
    { id: 'A', theta: 0.1 },
    { id: 'B', theta: 0.1 },
  ];

  pinner.setLayout(layout);

  const first = pinner.step(states, collarPoint, DESKTOP_BASE, 1 / 60, false);

  assert.ok(Math.abs(first.x - b.x) < 1e-6, 'centre x on the cord');
  assert.ok(Math.abs(first.y - b.slipRect.y) < 1e-6, 'top at the strip rect');
  assert.ok(Math.abs(first.thetaDeg - 0.1 * 0.8 * (180 / Math.PI)) < 1e-9);

  // The collar moves 10 px right; the pin follows with damp λ 12.
  collarPx.x += 10;
  const next = pinner.step(states, collarPoint, DESKTOP_BASE, 1 / 60, false);
  const k = 1 - Math.exp(-12 / 60);

  assert.ok(Math.abs(next.x - (b.x + 10 * k)) < 1e-6);
  // A snap (reduced motion) lands at once.
  const snapped = pinner.step(states, collarPoint, DESKTOP_BASE, 1 / 60, true);

  assert.ok(Math.abs(snapped.x - (b.x + 10)) < 1e-6);
  // A layout without a slip pins nothing.
  pinner.setLayout(routeLayout('/orbital', DESKTOP_BASE, false, {}));
  assert.equal(
    pinner.step(states, collarPoint, DESKTOP_BASE, 1 / 60, false),
    null,
  );
});
