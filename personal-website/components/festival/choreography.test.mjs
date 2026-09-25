import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChoreography,
  EXIT_CONFIRM_S,
  ROUTE_EXIT_S,
} from './scene/choreography.ts';
import { DESKTOP_BASE, MOBILE_BASE, routeLayout } from './scene/layout.ts';
import { CHOREOGRAPHY } from './scene/types.ts';

const MOUNT = CHOREOGRAPHY.mount;
const ROUTE = CHOREOGRAPHY.route;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** A sim that records commands and drains its own queue on `advance`. */
function recordingSim(ts = 10) {
  const calls = [];
  const queue = [];
  const state = { ts, settled: false };
  const sim = {
    state,
    calls,
    lowerIn: (id, o) => calls.push(['lowerIn', id, o]),
    raise: (id, o) => calls.push(['raise', id, o]),
    light: (id, o) => calls.push(['light', id, o]),
    snapshotLift: (l, px) => calls.push(['snapshotLift', l, px]),
    setSequenceStart: (t) => calls.push(['setSequenceStart', t]),
    schedule: (at, fn) => queue.push({ at, fn }),
    /** Runs every job due by `to`, in order, then sets `ts`. */
    advance(to) {
      queue.sort((a, b) => a.at - b.at);
      while (queue.length && queue[0].at <= to) {
        const job = queue.shift();

        state.ts = job.at;
        job.fn();
      }
      state.ts = to;
    },
    pending: () => queue.map((j) => j.at),
  };

  return sim;
}

function recordingMoon() {
  const calls = [];

  return {
    calls,
    avoid: (r) => calls.push(['avoid', r]),
    enter: (l, ts) => calls.push(['enter', l.route, ts]),
    glideCrosses: () => false,
  };
}

function harness({
  path = '/blog',
  viewport = DESKTOP_BASE,
  mobile = false,
  ts = 10,
} = {}) {
  const sim = recordingSim(ts);
  const moon = recordingMoon();
  const events = [];
  let layout = routeLayout(path, viewport, mobile, {});
  let view = { phase: 'hidden', translationShown: false };
  let scrollY = 0;
  let reduced = false;
  let night = 1;
  const choreo = createChoreography({
    sim: () => sim,
    moon,
    nightTarget: () => night,
    layout: () => layout,
    resolveLayout: (p) => routeLayout(p, viewport, mobile, {}),
    navBandFor: (p) => routeLayout(p, viewport, mobile, {})?.navBand ?? null,
    applyLayout: (next, moonDone) => {
      layout = next;
      events.push(['applyLayout', next.route, moonDone]);
    },
    onEnter: (timing) => {
      view = { phase: 'enter', translationShown: false };
      events.push(['onEnter', timing]);
    },
    onExit: () => {
      view = { ...view, phase: 'exit' };
      events.push(['onExit']);
    },
    reveal: (part) => {
      if (part === 'translation') view = { ...view, translationShown: true };
      events.push(['reveal', part]);
    },
    view: () => view,
    scrollY: () => scrollY,
    reduced: () => reduced,
    renderReduced: () => events.push(['renderReduced']),
    setSettled: (on) => events.push(['setSettled', on]),
    disposed: () => false,
  });

  return {
    sim,
    moon,
    events,
    choreo,
    layout: () => layout,
    setScrollY: (y) => (scrollY = y),
    setReduced: (r) => (reduced = r),
    setNight: (n) => (night = n),
  };
}

const of = (calls, name) => calls.filter((c) => c[0] === name);

test('§4.1 mount: lanterns lower in at 120·i over 1100 ms, catch at arrival + 150 (dark only), text at 1400 / 2000 / 1900', () => {
  const h = harness();

  h.choreo.enterSequence('mount', 10);

  const lowers = of(h.sim.calls, 'lowerIn');

  assert.deepEqual(
    lowers.map((c) => c[1]),
    ['A', 'B', 'C'],
  );
  for (const [i, c] of lowers.entries()) {
    assert.ok(near(c[2].delayS, 0.12 * i), `${c[1]} lowers at ${0.12 * i}`);
    assert.equal(c[2].durationS, 1.1);
  }
  assert.deepEqual(h.events, [
    ['onEnter', 'mount'],
    ['setSettled', false],
  ]);
  // The hero's catch fires at 10 + 1.1 + 0.15 with the mount keyframes.
  h.sim.advance(10 + 1.1 + 0.15);
  const lit = of(h.sim.calls, 'light');

  assert.equal(lit.length, 1);
  assert.equal(lit[0][1], 'A');
  assert.deepEqual(lit[0][2], {
    delayS: 0,
    durationS: MOUNT.candleMs / 1000,
    target: 1,
    poolDelayS: MOUNT.poolDelayMs / 1000,
    poolDurationS: MOUNT.poolMs / 1000,
  });
  h.sim.advance(10 + 2.1);
  assert.equal(of(h.sim.calls, 'light').length, 3, 'every lantern catches');
  assert.deepEqual(
    h.events.filter((e) => e[0] === 'reveal').map((e) => e[1]),
    ['poem', 'slip', 'colophon'],
    'poem at 1.4 s, slip at 1.9 s, colophon at 2.0 s',
  );
});

test('§4.1 a theme flip to light during the lower-in leaves the candle out', () => {
  const h = harness();

  h.choreo.enterSequence('mount', 10);
  h.setNight(0);
  h.sim.advance(14);
  assert.equal(of(h.sim.calls, 'light').length, 0);
});

test('§4.2 exit rows: candle out over 160 ms, then the rise from +40 over 240, all lanterns together', () => {
  const h = harness();

  h.choreo.exitSequence();
  for (const spec of h.layout().lanterns) {
    const light = of(h.sim.calls, 'light').find((c) => c[1] === spec.id);
    const raise = of(h.sim.calls, 'raise').find((c) => c[1] === spec.id);

    assert.deepEqual(light[2], { delayS: 0, durationS: 0.16, target: 0 });
    assert.deepEqual(raise[2], { delayS: 0.04, durationS: 0.24, px: 40 });
  }
  assert.deepEqual(h.events, [['onExit'], ['setSettled', false]]);
});

test('§4.2 a link click starts the exit; the matching pathname confirms it and enters from exit + 280 ms', () => {
  const h = harness();

  h.choreo.startExit('/past-experience');
  assert.equal(of(h.sim.calls, 'raise').length, 3, 'exit at the click');
  assert.ok(h.sim.pending().some((t) => near(t, 10 + EXIT_CONFIRM_S)));

  // The commit lands 90 ms later: no second exit, the moon learns the new
  // nav band at once, the re-read at +60, the relayout at exit + 280.
  h.sim.advance(10.09);
  h.choreo.routeChange('/past-experience');
  assert.equal(of(h.sim.calls, 'raise').length, 3, 'one exit');
  assert.deepEqual(h.moon.calls[0], [
    'avoid',
    { x: 176, y: 56, w: 1088, h: 75 },
  ]);
  const base = 10 + ROUTE_EXIT_S - ROUTE_EXIT_S;

  h.sim.advance(10.09 + 0.06);
  assert.deepEqual(h.moon.calls[1], ['enter', '/past-experience', 10.15]);
  h.sim.advance(10 + ROUTE_EXIT_S);
  assert.deepEqual(h.events.filter((e) => e[0] === 'applyLayout')[0], [
    'applyLayout',
    '/past-experience',
    true,
  ]);
  assert.deepEqual(of(h.sim.calls, 'setSequenceStart')[0], [
    'setSequenceStart',
    base,
  ]);
  // Enter rows count from the exit start: hero lowers at +300, B at +390.
  const lowers = of(h.sim.calls, 'lowerIn');

  assert.equal(lowers.length, 2);
  assert.ok(near(lowers[0][2].delayS, base + 0.3 - (10 + ROUTE_EXIT_S)));
  assert.ok(near(lowers[1][2].delayS, base + 0.39 - (10 + ROUTE_EXIT_S)));
  assert.equal(lowers[0][2].durationS, ROUTE.lowerInMs / 1000);
  // The stale 4 s fallback never lowers the lanterns back in.
  h.sim.advance(10 + EXIT_CONFIRM_S + 1);
  assert.equal(of(h.sim.calls, 'lowerIn').length, 2);
});

test('§4.2 a pathname change without a click runs the exit itself; no confirmation within 4 s lowers the lanterns back in', () => {
  const h = harness();

  h.choreo.routeChange('/schedule-a-call');
  assert.equal(of(h.sim.calls, 'raise').length, 3);
  h.sim.advance(11);
  assert.equal(of(h.sim.calls, 'lowerIn').length, 3, 'entered');

  const g = harness();

  g.choreo.startExit('/nowhere');
  g.sim.advance(10 + EXIT_CONFIRM_S);
  assert.equal(of(g.sim.calls, 'lowerIn').length, 3, 'lowered back in');
  assert.deepEqual(g.events.at(-2), ['onEnter', 'route']);
});

test('§3.3 scroll-lift: past 120 the candle goes out and the lantern rises 24 px over 260; below 40 it lowers in and catches', () => {
  const h = harness({ path: '/blog', viewport: MOBILE_BASE, mobile: true });

  h.choreo.enterSequence('mount', 10);
  h.sim.calls.length = 0;
  h.setScrollY(200);
  h.choreo.stepScrollLift();
  assert.equal(h.choreo.lifted, true);
  assert.deepEqual(of(h.sim.calls, 'light')[0][2], {
    delayS: 0,
    durationS: 0.16,
    target: 0,
  });
  assert.deepEqual(of(h.sim.calls, 'raise')[0][2], {
    delayS: 0.04,
    durationS: 0.26,
    px: 24,
  });
  h.choreo.stepScrollLift();
  assert.equal(of(h.sim.calls, 'raise').length, 1, 'lifts once');

  h.setScrollY(0);
  h.choreo.stepScrollLift();
  assert.equal(h.choreo.lifted, false);
  assert.deepEqual(of(h.sim.calls, 'lowerIn')[0][2], {
    delayS: 0.3,
    durationS: 0.52,
  });
  h.sim.advance(10 + 0.3 + 0.52 + 0.1);
  assert.equal(of(h.sim.calls, 'light').at(-1)[2].target, 1, 'catches');
});

test('§4.2 a page entered already scrolled parks the lantern (snapshotLift) instead of lowering it in; a lift during the lower-in skips the catch', () => {
  const h = harness({ path: '/blog', viewport: MOBILE_BASE, mobile: true });

  h.setScrollY(600);
  h.choreo.enterSequence('mount', 10);
  assert.deepEqual(of(h.sim.calls, 'snapshotLift'), [
    ['snapshotLift', true, 24],
  ]);
  assert.equal(of(h.sim.calls, 'lowerIn').length, 0);
  assert.equal(h.choreo.lifted, true);
  h.sim.advance(14);
  assert.equal(
    of(h.sim.calls, 'light').length,
    0,
    'nothing lights a parked lantern',
  );

  const g = harness({ path: '/blog', viewport: MOBILE_BASE, mobile: true });

  g.choreo.enterSequence('mount', 10);
  g.setScrollY(200);
  g.sim.advance(10.5);
  g.choreo.stepScrollLift();
  g.sim.advance(14);
  assert.equal(
    of(g.sim.calls, 'light').filter((c) => c[2].target === 1).length,
    0,
    'the mount catch is skipped while lifted',
  );
});

test('§4.2 a route enter resets the lift: the new page hangs its lanterns whatever the old page did', () => {
  const h = harness({ path: '/blog', viewport: MOBILE_BASE, mobile: true });

  h.choreo.enterSequence('mount', 10);
  h.setScrollY(200);
  h.choreo.stepScrollLift();
  assert.equal(h.choreo.lifted, true);
  h.sim.calls.length = 0;
  h.setScrollY(0);
  h.choreo.routeChange('/blog/introduction');
  h.sim.advance(10 + ROUTE_EXIT_S);
  assert.equal(h.choreo.lifted, false);

  const entered = of(h.sim.calls, 'lowerIn').length;

  assert.equal(entered, 1, 'the route enter hangs the lantern');
  h.choreo.stepScrollLift();
  assert.equal(
    of(h.sim.calls, 'lowerIn').length,
    entered,
    'no second lower-in from a stale lift',
  );
});

test('§4.1 the translation lands at the settle event and data-festival-settled 500 ms later, once', () => {
  const h = harness();

  h.choreo.enterSequence('mount', 10);
  h.choreo.advanceSettle();
  assert.ok(!h.events.some((e) => e[0] === 'reveal' && e[1] === 'translation'));
  h.sim.state.settled = true;
  h.choreo.advanceSettle();
  h.choreo.advanceSettle();
  assert.equal(
    h.events.filter((e) => e[0] === 'reveal' && e[1] === 'translation').length,
    1,
  );
  h.sim.advance(10 + MOUNT.settledAfterTranslationMs / 1000);
  assert.deepEqual(h.events.at(-1), ['setSettled', true]);
});

test('§4.6 reduced motion: a route change swaps the layout and re-renders one frame, no rows', () => {
  const h = harness();

  h.setReduced(true);
  h.choreo.routeChange('/past-experience');
  assert.deepEqual(h.events, [
    ['applyLayout', '/past-experience', false],
    ['renderReduced'],
  ]);
  assert.equal(h.sim.calls.length, 0);
  h.choreo.startExit('/blog');
  assert.equal(h.sim.calls.length, 0, 'no exit under reduced motion');
});
