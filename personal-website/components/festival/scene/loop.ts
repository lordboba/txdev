/**
 * The layer's render loop (bible §4, §4.7, §7.5): requestAnimationFrame at
 * most 60 Hz (a frame is skipped when < 15 ms have passed), paused while the
 * tab is hidden or an overlay covers the page, resumed without a burst.
 *
 * Pausing is event-driven where it can be: `visibilitychange` wakes the loop
 * when the tab returns and no timer runs while the document is hidden. The
 * 200 ms poll remains only for the overlay cases (journey, lightbox, modal),
 * whose closing has no event.
 *
 * It also keeps the §7.5 frame-timing row: an exponential moving average of
 * the frame's CPU time and the maximum over the last 120 frames, read by
 * `window.__festival.frameMs()`.
 *
 * The timers and the document are injected so the node test can drive it.
 */

export interface LoopIo {
  /** `document.hidden` and the listener target for `visibilitychange`. */
  hidden(): boolean;
  addVisibilityListener(fn: () => void): void;
  removeVisibilityListener(fn: () => void): void;
  raf(fn: (nowMs: number) => void): number;
  caf(id: number): void;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  now(): number;
  /** True while the loop must not run (hidden, overlay open, off-screen). */
  shouldPause(): boolean;
  /** One frame; `nowMs` is the rAF timestamp. */
  onFrame(nowMs: number): void;
  onPause(): void;
  onResume(): void;
  /** Frames closer than this are skipped (15 ms: the 60 Hz cap). */
  minFrameGapMs: number;
  /** Overlay poll while paused, ms. */
  pollMs: number;
}

export interface Loop {
  /** Starts (or resumes) the loop. */
  start(): void;
  /** Cancels the frame and the poll; `start()` resumes. */
  stop(): void;
  running(): boolean;
  frames(): number;
  /** CPU ms per frame: exponential average and the max over the last 120. */
  frameMs(): { avg: number; max: number };
  dispose(): void;
}

const MAX_WINDOW = 120;

export function createLoop(io: LoopIo): Loop {
  let rafId = 0;
  let pollId = 0;
  let lastFrameMs = 0;
  let frames = 0;
  let avg = 0;
  let disposed = false;
  let paused = false;
  const recent = new Float32Array(MAX_WINDOW);
  let recentAt = 0;

  const clearTimers = () => {
    if (rafId) io.caf(rafId);
    rafId = 0;
    if (pollId) io.clearTimeout(pollId);
    pollId = 0;
  };

  const pause = () => {
    clearTimers();
    lastFrameMs = 0;
    paused = true;
    io.onPause();
    armPoll();
  };

  /** While hidden the `visibilitychange` event wakes the loop; no timer. */
  const armPoll = () => {
    if (disposed || io.hidden()) return;
    pollId = io.setTimeout(poll, io.pollMs);
  };

  const poll = () => {
    pollId = 0;
    if (disposed) return;
    if (io.shouldPause()) {
      armPoll();

      return;
    }
    resume();
  };

  const resume = () => {
    if (disposed || rafId) return;
    if (pollId) io.clearTimeout(pollId);
    pollId = 0;
    paused = false;
    lastFrameMs = 0;
    io.onResume();
    rafId = io.raf(tick);
  };

  const tick = (nowMs: number) => {
    rafId = 0;
    if (disposed) return;
    if (io.shouldPause()) {
      pause();

      return;
    }
    if (nowMs - lastFrameMs < io.minFrameGapMs) {
      rafId = io.raf(tick);

      return;
    }
    lastFrameMs = nowMs;

    const t0 = io.now();

    io.onFrame(nowMs);

    const cost = io.now() - t0;

    frames += 1;
    avg = frames === 1 ? cost : avg + (cost - avg) / 60;
    recent[recentAt] = cost;
    recentAt = (recentAt + 1) % MAX_WINDOW;
    rafId = io.raf(tick);
  };

  const onVisibility = () => {
    if (disposed) return;
    if (io.hidden()) {
      if (rafId) pause();
    } else if (paused && !pollId) {
      poll();
    }
  };

  io.addVisibilityListener(onVisibility);

  return {
    start() {
      if (disposed) return;
      if (io.shouldPause()) {
        paused = true;
        io.onPause();
        armPoll();

        return;
      }
      resume();
    },

    stop() {
      clearTimers();
      paused = false;
      lastFrameMs = 0;
    },

    running: () => rafId !== 0,
    frames: () => frames,

    frameMs() {
      let max = 0;
      const n = Math.min(frames, MAX_WINDOW);

      for (let i = 0; i < n; i += 1) max = Math.max(max, recent[i]);

      return { avg, max };
    },

    dispose() {
      disposed = true;
      clearTimers();
      io.removeVisibilityListener(onVisibility);
    },
  };
}
