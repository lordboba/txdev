import assert from 'node:assert/strict';
import test from 'node:test';

import { createLoop } from './scene/loop.ts';

/** A fake document / rAF / timers the loop can be driven through. */
function harness({ pauseWhen = () => false } = {}) {
  const h = {
    hidden: false,
    visibility: [],
    rafs: new Map(),
    timers: new Map(),
    nextId: 1,
    clock: 0,
    frames: [],
    pauses: 0,
    resumes: 0,
    paused: false,
  };
  const loop = createLoop({
    hidden: () => h.hidden,
    addVisibilityListener: (fn) => h.visibility.push(fn),
    removeVisibilityListener: (fn) =>
      h.visibility.splice(h.visibility.indexOf(fn), 1),
    raf: (fn) => {
      const id = h.nextId++;

      h.rafs.set(id, fn);

      return id;
    },
    caf: (id) => h.rafs.delete(id),
    setTimeout: (fn, ms) => {
      const id = h.nextId++;

      h.timers.set(id, { fn, at: h.clock + ms });

      return id;
    },
    clearTimeout: (id) => h.timers.delete(id),
    now: () => h.clock,
    shouldPause: () => h.hidden || pauseWhen(),
    onFrame: (nowMs) => {
      h.frames.push(nowMs);
      h.clock += 0.5; // half a millisecond of work per frame
    },
    onPause: () => {
      h.pauses += 1;
      h.paused = true;
    },
    onResume: () => {
      h.resumes += 1;
      h.paused = false;
    },
    minFrameGapMs: 15,
    pollMs: 200,
  });

  /** Runs one rAF callback at `nowMs` if one is queued. */
  h.frame = (nowMs) => {
    const [id, fn] = h.rafs.entries().next().value ?? [];

    if (!fn) return false;
    h.rafs.delete(id);
    h.clock = Math.max(h.clock, nowMs);
    fn(nowMs);

    return true;
  };
  h.fireTimers = () => {
    for (const [id, t] of [...h.timers]) {
      if (t.at <= h.clock) {
        h.timers.delete(id);
        t.fn();
      }
    }
  };
  h.setHidden = (hidden) => {
    h.hidden = hidden;
    h.visibility.forEach((fn) => fn());
  };

  return { h, loop };
}

test('§4 the loop renders at most 60 Hz: a frame < 15 ms after the last is skipped', () => {
  const { h, loop } = harness();

  loop.start();
  assert.equal(h.resumes, 1);
  h.frame(1000);
  h.frame(1008); // too soon: skipped, re-armed
  h.frame(1017);
  h.frame(1033);
  assert.deepEqual(h.frames, [1000, 1017, 1033]);
  assert.equal(loop.frames(), 3);
  assert.equal(h.rafs.size, 1, 'always one frame in flight');
  loop.dispose();
  assert.equal(h.rafs.size, 0);
  assert.equal(h.visibility.length, 0);
});

test('§4.7 hidden: no frame, no timer; visibilitychange wakes the loop', () => {
  const { h, loop } = harness();

  loop.start();
  h.frame(1000);
  h.setHidden(true);
  assert.equal(h.pauses, 1);
  assert.equal(h.rafs.size, 0, 'the frame is cancelled');
  assert.equal(h.timers.size, 0, 'no poll while hidden');
  h.clock += 5000;
  h.fireTimers();
  assert.equal(h.frames.length, 1, 'zero frames while hidden');

  h.setHidden(false);
  assert.equal(h.resumes, 2, 'resumed by the event');
  assert.equal(h.rafs.size, 1);
  h.frame(6100);
  assert.equal(h.frames.length, 2);
});

test('§4.7 an overlay pauses the loop and the 200 ms poll resumes it once it closes', () => {
  let overlay = false;
  const { h, loop } = harness({ pauseWhen: () => overlay });

  loop.start();
  h.frame(1000);
  overlay = true;
  h.frame(1020);
  assert.equal(h.pauses, 1);
  assert.equal(h.frames.length, 1, 'no frame under the overlay');
  assert.equal(h.timers.size, 1, 'one poll armed');
  h.clock += 200;
  h.fireTimers();
  assert.equal(h.timers.size, 1, 'still covered: re-armed');
  overlay = false;
  h.clock += 200;
  h.fireTimers();
  assert.equal(h.resumes, 2);
  assert.equal(h.rafs.size, 1);
});

test('§7.5 frameMs: an exponential average and the max over the last 120 frames', () => {
  const { h, loop } = harness();

  loop.start();
  for (let i = 0; i < 130; i += 1) h.frame(1000 + i * 20);
  const { avg, max } = loop.frameMs();

  assert.ok(Math.abs(avg - 0.5) < 1e-6, `avg ${avg}`);
  assert.ok(Math.abs(max - 0.5) < 1e-6, `max ${max}`);
  assert.equal(loop.frames(), 130);
});
