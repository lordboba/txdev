import assert from 'node:assert/strict';
import test from 'node:test';

import { DESKTOP_BASE, routeLayout } from './scene/layout.ts';
import { createSim, SETTLE_GATES } from './scene/sim.ts';
import { PENDULUM, WIND } from './scene/types.ts';
import {
  claimWindListeners,
  createWind,
  createWindInstance,
  currentWind,
  disposeWind,
  gustField,
  releaseWindListeners,
} from './scene/wind.ts';

const FRAME_MS = 1000 / 60;
const DEG = 180 / Math.PI;

const blog = () => routeLayout('/blog', DESKTOP_BASE, false, {});

/** A wind stub for physics tests: no breeze, no gusts, a scripted field. */
function stubWind(sample = () => 0) {
  let ts = 0;
  let vertical = 0;

  return {
    time: () => ts,
    tick(nowMs) {
      const dt = Math.min(nowMs / 1000 - ts, PENDULUM.dtClampS);

      ts += dt;

      return dt;
    },
    sample: (x01, at = ts) => sample(x01, at),
    vertical: () => vertical,
    cursor() {},
    cursorForceAt: () => 0,
    touch() {},
    scroll(v) {
      vertical = Math.max(-3, Math.min(3, v)) * 0.25;
    },
    scheduleGust() {},
    gusts: () => [],
    pause() {},
    resume() {},
    paused: () => false,
    reseed() {},
    seed: () => 0,
    random: () => 0.5,
  };
}

/** Steps `sim` with `wind` at 60 Hz for `seconds`, calling `each` per frame. */
function run(sim, wind, seconds, each = () => {}) {
  let now = 0;

  wind.tick(now);
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    now += FRAME_MS;
    sim.step(wind.tick(now));
    each(sim.state, i);
  }
}

/** The §4.1 mount sequence for the lanterns (lower-in, then the candle). */
function mountLanterns(sim, layout) {
  for (const spec of layout.lanterns) {
    const delayS = (120 * spec.order) / 1000;

    sim.lowerIn(spec.id, { delayS, durationS: 1.1 });
    sim.light(spec.id, {
      delayS: delayS + 1.1 + 0.15,
      durationS: 0.7,
      target: 1,
    });
  }
}

test('§4.5 each lantern swings at its own period, within 2% of T (zero-crossings)', () => {
  const layout = blog();
  // One 0.3 s push at t = 0.5 s, then free swing about θ = 0.
  const wind = stubWind((_, at) => (at > 0.5 && at < 0.8 ? 4 : 0));
  const sim = createSim({
    seed: 1,
    layout,
    wind,
    night: 1,
    reducedMotion: false,
  });

  for (const spec of layout.lanterns)
    sim.lowerIn(spec.id, { delayS: 0, durationS: 0 });

  const samples = layout.lanterns.map(() => []);

  run(sim, wind, 16, (state) => {
    state.lanterns.forEach((l, k) => samples[k].push([state.ts, l.theta]));
  });

  layout.lanterns.forEach((spec, k) => {
    const crossings = [];
    const series = samples[k];

    for (let i = 1; i < series.length; i += 1) {
      const [t0, a] = series[i - 1];
      const [t1, b] = series[i];

      if (t0 < 2) continue;
      if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) {
        crossings.push(t0 + ((t1 - t0) * a) / (a - b));
      }
    }
    assert.ok(
      crossings.length >= 6,
      `${spec.id} has ${crossings.length} crossings`,
    );

    const measured =
      (2 * (crossings[crossings.length - 1] - crossings[0])) /
      (crossings.length - 1);
    const error = Math.abs(measured - spec.period) / spec.period;

    assert.ok(
      error < 0.02,
      `${spec.id}: measured ${measured.toFixed(3)} s vs T ${spec.period} (${(error * 100).toFixed(2)}%)`,
    );
  });

  const periods = layout.lanterns.map((s) => s.period).sort();

  for (let i = 1; i < periods.length; i += 1) {
    assert.ok(periods[i] / periods[i - 1] > 1.08, 'no two periods within 8%');
  }
});

test('§4.1 the mount sequence settles between the floor and 6 s on /blog', () => {
  const layout = blog();
  const wind = createWindInstance(7);
  const sim = createSim({
    seed: 7,
    layout,
    wind,
    night: 1,
    reducedMotion: false,
  });

  sim.prewarm(6);
  assert.equal(sim.state.ts, 0, 'prewarm leaves the clock where it was');
  assert.ok(
    sim.state.fall.some((f) => f.y > layout.florets.emitters[0].y + 100),
    'florets are mid-fall after the prewarm',
  );

  mountLanterns(sim, layout);

  let settledAt = null;

  run(sim, wind, 8, (state) => {
    if (settledAt === null && state.settled) settledAt = state.ts;
  });

  assert.ok(settledAt !== null, 'settled');
  assert.ok(settledAt >= SETTLE_GATES.mount.floorS, `floor: ${settledAt}`);
  assert.ok(settledAt < 6, `settled at ${settledAt} s`);
  for (const l of sim.state.lanterns) {
    assert.equal(l.cordLength, l.cordTarget, `${l.id} at length`);
    assert.equal(l.lit, 1, `${l.id} lit`);
    assert.equal(l.alpha, 1);
  }
});

test('§7.1 ten minutes of sim with cursor and scroll input: no NaN, every clamp holds', () => {
  const layout = blog();
  const wind = createWindInstance(11);
  const sim = createSim({
    seed: 11,
    layout,
    wind,
    night: 1,
    reducedMotion: false,
  });

  sim.prewarm(6);
  mountLanterns(sim, layout);

  let now = 0;
  let minAlpha = 1;

  wind.tick(now);
  for (let i = 0; i < 600 * 30; i += 1) {
    now += 1000 / 30; // 33 ms frames: the clamp is exercised every step
    if (i % 97 === 0)
      wind.cursor(1500, { x: 96 + (i % 300), y: 160 }, layout.viewport);
    if (i % 131 === 0) wind.scroll(i % 2 ? 4 : -4);
    if (i % 1500 === 0) wind.touch({ x: 200, y: 400 }, layout.viewport);
    sim.step(wind.tick(now));

    const { lanterns, poem, fall } = sim.state;

    for (const l of lanterns) {
      for (const [key, value] of Object.entries(l)) {
        if (typeof value === 'number')
          assert.ok(Number.isFinite(value), `${l.id}.${key} at ${i}`);
      }
      assert.ok(
        Math.abs(l.theta) <= PENDULUM.idleClampRad + 1e-9,
        `${l.id} θ clamp`,
      );
      assert.ok(
        Math.abs(l.bob) <= PENDULUM.bob.maxPx + 1e-9,
        `${l.id} bob clamp`,
      );
      assert.ok(l.candle >= 0.94 && l.candle <= 1.1, `${l.id} candle`);
    }
    assert.ok(
      Math.abs(poem.leanDeg) <= PENDULUM.poem.clampDeg,
      'poem lean clamp',
    );
    assert.equal(fall.length, layout.florets.count);
    for (const f of fall) {
      assert.ok(
        Number.isFinite(f.x) &&
          Number.isFinite(f.y) &&
          Number.isFinite(f.alpha),
      );
      assert.ok(f.alpha >= 0 && f.alpha <= 1);
      minAlpha = Math.min(minAlpha, f.alpha);
    }
  }
  assert.ok(sim.state.ts > 590, `sim time advanced (${sim.state.ts})`);
  assert.ok(
    sim.state.fall.some((f) => f.alpha > 0.5),
    'florets still visible',
  );
});

test('§4.4 scroll wind bobs ≤ 8 px and lifts florets ≤ 12 px; a pointer sweep leans the near lantern more', () => {
  const layout = blog();
  const wind = createWindInstance(3, { gusts: false });
  const sim = createSim({
    seed: 3,
    layout,
    wind,
    night: 1,
    reducedMotion: false,
  });

  for (const spec of layout.lanterns)
    sim.lowerIn(spec.id, { delayS: 0, durationS: 0 });

  let maxBob = 0;
  let maxLift = 0;

  run(sim, wind, 2, (state, i) => {
    if (i === 30) {
      wind.scroll(5);
      assert.ok(
        Math.abs(wind.vertical() - 0.75) < 1e-9,
        'Fy clamps to 3 × 0.25',
      );
    }
    for (const l of state.lanterns) maxBob = Math.max(maxBob, Math.abs(l.bob));
    maxLift = Math.max(maxLift, (12 * Math.abs(wind.vertical())) / 0.75);
  });
  assert.ok(
    maxBob > 2 && maxBob <= PENDULUM.bob.maxPx,
    `bob peaked at ${maxBob}`,
  );
  assert.ok(maxLift <= WIND.scroll.floretLiftMaxPx);

  const near = layout.lanterns[0];
  const far = layout.lanterns[2];
  let nearPeak = 0;
  let farPeak = 0;

  run(sim, wind, 3, (state, i) => {
    if (i < 30) {
      // A 1200 px/s sweep (M5) that comes in from the page and stops beside the hero.
      wind.cursor(
        -1200,
        { x: near.x + 620 - i * 20, y: near.bodyRect.y + 30 },
        layout.viewport,
      );
    }
    nearPeak = Math.max(nearPeak, Math.abs(state.lanterns[0].theta) * DEG);
    farPeak = Math.max(farPeak, Math.abs(state.lanterns[2].theta) * DEG);
  });
  assert.ok(
    nearPeak >= 8,
    `near lantern ${near.id} deflected ${nearPeak.toFixed(1)}°`,
  );
  assert.ok(
    farPeak <= 3,
    `far lantern ${far.id} deflected ${farPeak.toFixed(1)}°`,
  );
});

test('§4.7 a hidden tab produces zero steps; resume continues without a jump', () => {
  disposeWind();

  const wind = createWind(5);
  const listeners = new Map();
  const doc = {
    hidden: false,
    addEventListener: (type, fn) => listeners.set(`document:${type}`, fn),
    removeEventListener: (type) => listeners.delete(`document:${type}`),
  };
  const win = {
    innerHeight: 900,
    scrollY: 0,
    document: doc,
    performance: { now: () => 0 },
    addEventListener: (type, fn) => listeners.set(`window:${type}`, fn),
    removeEventListener: (type) => listeners.delete(`window:${type}`),
  };

  assert.equal(createWind(5), wind, 'the singleton is shared');
  assert.equal(currentWind(), wind);

  const token = claimWindListeners(win, wind);

  assert.ok(token, 'first claim owns the listeners');
  assert.equal(
    claimWindListeners(win, wind),
    null,
    'a second mount cannot claim them',
  );
  assert.equal(listeners.size, 2);

  wind.tick(0);
  wind.tick(100);
  assert.ok(Math.abs(wind.time() - 0.033) < 1e-9, 'dt clamps to 33 ms');

  doc.hidden = true;
  listeners.get('document:visibilitychange')();
  assert.equal(wind.paused(), true);

  const before = wind.time();

  for (let i = 0; i < 100; i += 1) assert.equal(wind.tick(200 + i * 16), 0);
  assert.equal(wind.time(), before, 'hidden = 0 steps');

  doc.hidden = false;
  listeners.get('document:visibilitychange')();
  assert.equal(wind.paused(), false);
  assert.equal(
    wind.tick(5000),
    0,
    'the first tick after resume only re-arms the clock',
  );
  assert.ok(Math.abs(wind.tick(5016) - 0.016) < 1e-9, 'then steps normally');

  releaseWindListeners(Symbol('impostor'));
  assert.equal(listeners.size, 2, 'a foreign token cannot release');
  releaseWindListeners(token);
  assert.equal(listeners.size, 0);

  assert.equal(createWind(9), wind, 'a new seed reseeds the same instance');
  assert.equal(wind.seed(), 9);
  assert.equal(
    wind.gusts()[0].at,
    WIND.gust.firstAtS,
    'the train restarts at 4.4 s',
  );
  disposeWind();
  assert.equal(currentWind(), null);
});

test('§7.1 the same seed reproduces the same state; another seed does not', () => {
  const make = (seed) => {
    const layout = blog();
    const wind = createWindInstance(seed);
    const sim = createSim({
      seed,
      layout,
      wind,
      night: 1,
      reducedMotion: false,
    });

    sim.prewarm(6);
    mountLanterns(sim, layout);
    run(sim, wind, 7, (_, i) => {
      if (i === 200) wind.cursor(900, { x: 120, y: 150 }, layout.viewport);
      if (i === 260) wind.scroll(2);
    });

    return JSON.stringify(sim.state);
  };

  assert.equal(make(7), make(7));
  assert.notEqual(make(7), make(8));
});

test('§4.1 the first gust front reaches each /blog lantern at 4.4 + (x + 0.1 vw) / (0.55 vw/s) ± 120 ms', () => {
  const layout = blog();
  const vw = layout.viewport.w;
  const trace = (gusts) => {
    const wind = createWindInstance(7, { gusts });
    const sim = createSim({
      seed: 7,
      layout,
      wind,
      night: 1,
      reducedMotion: false,
    });
    const log = [];

    mountLanterns(sim, layout);
    run(sim, wind, 8, (state) => {
      log.push({
        ts: state.ts,
        theta: state.lanterns.map((l) => l.theta),
        field: layout.lanterns.map((s) =>
          gustField(wind.gusts(), s.x / vw, state.ts),
        ),
      });
    });

    return log;
  };
  const gusted = trace(true);
  const calm = trace(false);
  const expected = { A: 4.7, B: 4.85, C: 6.34 };

  layout.lanterns.forEach((spec, k) => {
    const formula =
      WIND.gust.firstAtS + (spec.x + 0.1 * vw) / (WIND.gust.speedVw * vw);

    assert.ok(
      Math.abs(formula - expected[spec.id]) < 0.01,
      `${spec.id} formula ${formula}`,
    );

    const front = gusted.find((row) => row.field[k] > 0);
    const onset = gusted.find(
      (row, i) => Math.abs(row.theta[k] - calm[i].theta[k]) * DEG > 0.01,
    );

    assert.ok(front && onset, `${spec.id} responds`);
    assert.ok(
      Math.abs(front.ts - formula) <= 0.12,
      `${spec.id} front at ${front.ts.toFixed(3)} vs ${formula.toFixed(3)}`,
    );
    assert.ok(
      onset.ts - formula >= 0 && onset.ts - formula <= 0.2,
      `${spec.id} θ answers ${(onset.ts - formula).toFixed(3)} s after the front`,
    );
  });

  // Arrival order and spacing follow x at 0.55 vw/s.
  const fronts = layout.lanterns.map(
    (_, k) => gusted.find((row) => row.field[k] > 0).ts,
  );

  assert.ok(fronts[0] < fronts[1] && fronts[1] < fronts[2]);
  assert.ok(
    Math.abs(fronts[2] - fronts[1] - (1395 - 214) / (0.55 * vw)) <= 0.12,
  );
});

test('§4.6 the reduced-motion snapshot is one still frame', () => {
  const layout = blog();
  const wind = createWindInstance(2);
  const sim = createSim({
    seed: 2,
    layout,
    wind,
    night: 0,
    reducedMotion: true,
  });

  sim.prewarm(6);

  const state = sim.snapshotReduced();

  assert.equal(state, sim.state);
  assert.equal(state.settled, true);
  for (const l of state.lanterns) {
    assert.equal(l.theta, 0.03);
    assert.equal(l.cordLength, l.cordTarget);
    assert.equal(l.lit, 0, 'light theme: unlit');
    assert.equal(l.alpha, 1);
  }
  sim.setNight(1);
  assert.equal(sim.snapshotReduced().lanterns[0].lit, 1, 'dark theme: lit');
  assert.ok(state.fall.every((f) => f.alpha >= 0 && Number.isFinite(f.x)));
});

test('§4.2 route change: candle out, raise, then a fresh lower-in on the next layout; florets never exit', () => {
  const from = blog();
  const to = routeLayout('/past-experience', DESKTOP_BASE, false, {});
  const wind = createWindInstance(4);
  const sim = createSim({
    seed: 4,
    layout: from,
    wind,
    night: 1,
    reducedMotion: false,
  });

  sim.prewarm(6);
  mountLanterns(sim, from);
  run(sim, wind, 4);
  assert.equal(sim.state.settled, true);

  for (const spec of from.lanterns) {
    sim.light(spec.id, { delayS: 0, durationS: 0.16, target: 0 });
    sim.raise(spec.id, { delayS: 0.04, durationS: 0.24, px: 40 });
  }

  let litWhenRiseStarted = null;
  let riseWhenLitOut = null;

  run(sim, wind, 0.3, (state) => {
    const hero = state.lanterns[0];

    if (litWhenRiseStarted === null && hero.rise > 0)
      litWhenRiseStarted = hero.lit;
    if (riseWhenLitOut === null && hero.lit === 0) riseWhenLitOut = hero.rise;
    assert.ok(
      state.fall.length > 0 && state.fall.some((f) => f.alpha > 0),
      'florets persist',
    );
  });
  assert.ok(
    litWhenRiseStarted !== null && litWhenRiseStarted < 1,
    'the candle is already going out when the lantern starts to rise',
  );
  assert.ok(
    riseWhenLitOut !== null && riseWhenLitOut < 8,
    `the candle is out before the rise passes 8 px (rise ${riseWhenLitOut})`,
  );
  assert.equal(sim.state.lanterns[0].alpha, 0);
  assert.equal(sim.state.lanterns[0].rise, 40);

  sim.setLayout(to, 'route');

  const enterTs = sim.state.ts;

  assert.equal(sim.state.lanterns.length, 2);
  assert.equal(sim.state.fall.length, to.florets.count);
  assert.equal(sim.state.settled, false);
  for (const spec of to.lanterns) {
    const delayS = 0.3 + (90 * spec.order) / 1000;

    sim.lowerIn(spec.id, { delayS, durationS: 0.52 });
    sim.light(spec.id, {
      delayS: delayS + 0.52 + 0.1,
      durationS: 0.42,
      target: 1,
    });
  }

  let settledAt = null;

  run(sim, wind, 4, (state) => {
    if (settledAt === null && state.settled) settledAt = state.ts;
    if (state.ts - enterTs < 1) return;
    for (const f of state.fall) {
      const rect = to.florets.emitters[f.emitter];

      assert.ok(
        f.y >= rect.y - 1 && f.y <= rect.y + rect.h + 13,
        'florets re-clamp into the new emitters within 1 s',
      );
    }
  });
  assert.ok(
    settledAt !== null &&
      settledAt - enterTs <= SETTLE_GATES.route.ceilingS + 0.05,
    `route settle ${settledAt}`,
  );
  assert.ok(
    sim.state.lanterns.every(
      (l) => l.lit === 1 && l.alpha === 1 && l.cordLength === l.cordTarget,
    ),
  );
});

test('§5.2 exact species counts: 22 florets, 8 leaves, 6 ginkgo at 36', () => {
  const layout = blog();
  const sim = createSim({
    seed: 7,
    layout,
    wind: stubWind(),
    night: 1,
    reducedMotion: false,
  });
  const counts = { floret: 0, leaf: 0, ginkgo: 0 };

  for (const f of sim.state.fall) counts[f.species] += 1;
  assert.deepEqual(counts, { floret: 22, leaf: 8, ginkgo: 6 });
  for (const f of sim.state.fall) {
    if (f.species === 'floret')
      assert.ok(f.sizePx >= 16 && f.sizePx <= 26, 'fascicle tile 16–26 px');
  }
});

test('§4.1 / §4.3 the pool row runs catch + 150 ms over 500 ms, and a snuff cancels a pending catch', () => {
  const layout = blog();
  const wind = stubWind();
  const sim = createSim({
    seed: 1,
    layout,
    wind,
    night: 1,
    reducedMotion: false,
  });
  const hero = layout.lanterns[0];

  sim.lowerIn(hero.id, { delayS: 0, durationS: 0 });
  sim.light(hero.id, { delayS: 0.1, durationS: 0.7, target: 1 });

  let litStart = null;
  let poolStart = null;
  let poolDone = null;

  run(sim, wind, 1.5, (state) => {
    const l = state.lanterns[0];

    if (litStart === null && l.lit > 0) litStart = state.ts;
    if (poolStart === null && l.pool > 0) poolStart = state.ts;
    if (poolDone === null && l.pool >= 1) poolDone = state.ts;
  });
  assert.ok(litStart !== null && poolStart !== null && poolDone !== null);
  assert.ok(
    Math.abs(poolStart - litStart - 0.15) < 0.04,
    `pool starts 150 ms after the catch (${(poolStart - litStart).toFixed(3)})`,
  );
  assert.ok(
    Math.abs(poolDone - poolStart - 0.5) < 0.04,
    `pool full 500 ms later (${(poolDone - poolStart).toFixed(3)})`,
  );

  // A catch queued for later, then the theme flips to light before it fires.
  const second = createSim({
    seed: 1,
    layout,
    wind: stubWind(),
    night: 1,
    reducedMotion: false,
  });
  const w2 = second === null ? null : stubWind();

  second.lowerIn(hero.id, { delayS: 0, durationS: 0 });
  second.light(hero.id, { delayS: 0.5, durationS: 0.7, target: 1 });
  run(second, w2, 0.2);
  second.light(hero.id, {
    delayS: 0,
    durationS: 0.26,
    target: 0,
    easing: 'exit',
    poolDurationS: 0.2,
  });
  run(second, w2, 2);
  assert.equal(second.state.lanterns[0].lit, 0, 'the stale catch never fired');
  assert.equal(second.state.lanterns[0].pool, 0);
});

test('§4.5 the tassel trails the first-gust peak by 80–150 ms with 15–25% relative amplitude', () => {
  const layout = blog();
  const wind = createWindInstance(7);
  const sim = createSim({
    seed: 7,
    layout,
    wind,
    night: 1,
    reducedMotion: false,
  });

  mountLanterns(sim, layout);

  const series = layout.lanterns.map(() => []);

  run(sim, wind, 9, (state) => {
    state.lanterns.forEach((l, k) =>
      series[k].push([state.ts, l.theta, l.tasselTheta]),
    );
  });

  // First |θ| peak after the gust reaches the lantern (4.4 s + the front),
  // then the first |tassel| peak from there.
  const peakAfter = (rows, col, from, floor) => {
    for (let i = 1; i < rows.length - 1; i += 1) {
      const t = rows[i][0];
      const v = Math.abs(rows[i][col]);

      if (
        t >= from &&
        v > floor &&
        v > Math.abs(rows[i - 1][col]) &&
        v >= Math.abs(rows[i + 1][col])
      )
        return rows[i];
    }

    return null;
  };

  layout.lanterns.forEach((spec, k) => {
    const body = peakAfter(series[k], 1, 4.6, 0.04);

    assert.ok(body, `${spec.id} answers the gust`);

    const tassel = peakAfter(series[k], 2, body[0] - 0.05, 0);

    assert.ok(tassel, `${spec.id} tassel peaks`);

    const lag = tassel[0] - body[0];
    const ratio = Math.abs(tassel[2] / body[1]);

    assert.ok(
      lag >= 0.08 && lag <= 0.15,
      `${spec.id} tassel lags ${(lag * 1000).toFixed(0)} ms`,
    );
    assert.ok(
      ratio >= 0.15 && ratio <= 0.25,
      `${spec.id} relative amplitude ${(ratio * 100).toFixed(0)}%`,
    );
  });
});

test('setEmitterRect moves one band in place: instances follow the tracked rect', () => {
  const layout = routeLayout('/', { w: 390, h: 844 }, true, {});
  const wind = stubWind();
  const sim = createSim({
    seed: 3,
    layout,
    wind,
    night: 1,
    reducedMotion: false,
  });

  sim.prewarm(6);
  assert.ok(sim.state.fall.length > 0);
  sim.setEmitterRect(0, { x: 0, y: 500, w: 390, h: 300 });
  run(sim, wind, 0.5);
  assert.deepEqual(layout.florets.emitters[0], {
    x: 0,
    y: 500,
    w: 390,
    h: 300,
  });
  for (const f of sim.state.fall) {
    assert.ok(f.y >= 500 - 1 && f.y <= 800 + 13, `y ${f.y} inside the band`);
    assert.ok(f.x >= -30 && f.x <= 420, `x ${f.x} inside the band`);
  }
});
