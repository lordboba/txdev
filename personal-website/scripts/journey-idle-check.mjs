#!/usr/bin/env node
/*
 * journey-idle-check.mjs — browser-verifies the bench's journey overlay with
 * no dependencies, over CDP's stdio pipe (the update-history.mjs plumbing).
 *
 * WHAT IT PROVES
 *   1. The scene loads and settles (dataset.benchSettled === 'true').
 *   2. Clicking the journey's DOM twin button opens the overlay, the camera
 *      transit lands (overlay revealed + settled again).
 *   3. IDLE PROOF: while the overlay is open with zero input, the demand-
 *      rendered Canvas underneath draws nothing — __benchGL.info.render.frame
 *      does not advance across a 5s hold.
 *   4. Escape unwinds the overlay closed, focus returns to the twin button,
 *      and the exit transit re-settles the scene.
 *   5. No console errors/warnings arrive during the whole story (Next dev
 *      tooling chatter is filtered), and /journey still serves a 200.
 *
 * USAGE
 *   node scripts/journey-idle-check.mjs [--url http://localhost:3000]
 *                                       [--reveal-timeout 20000]
 *   CHROME_PATH=/path/to/chrome   override browser discovery
 *   --reveal-timeout=<ms>         ceiling for the overlay reveal and the
 *                                 camera transits around it (default 20000;
 *                                 software GL needs ~180000). The watchdog
 *                                 stretches with it.
 *
 * Prints one JSON result object to stdout; exits 0 on pass, 1 on fail.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ---- argv ----------------------------------------------------------------- */

function readArg(name) {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`${name}=`));

  if (eq) {
    return eq.slice(name.length + 1);
  }

  const at = argv.indexOf(name);

  if (at !== -1 && argv[at + 1]) {
    return argv[at + 1];
  }

  return null;
}

function readUrlArg() {
  return readArg('--url') ?? 'http://localhost:3000';
}

function readRevealTimeoutArg(fallback) {
  const raw = readArg('--reveal-timeout');

  if (raw === null) {
    return fallback;
  }

  const ms = Number(raw);

  if (!Number.isInteger(ms) || ms <= 0) {
    throw new Error(
      `--reveal-timeout must be a positive integer of ms, got ${raw}`,
    );
  }

  return ms;
}

const ORIGIN = readUrlArg().replace(/\/$/, '');

/* ---- budgets -------------------------------------------------------------- */

/** Ceiling for the initial load + intro settle on software GL. */
const LOAD_SETTLE_MS = 60_000;
/** Ceiling for the journey entry/exit camera transits to land. */
const DEFAULT_TRANSIT_SETTLE_MS = 20_000;
const TRANSIT_SETTLE_MS = readRevealTimeoutArg(DEFAULT_TRANSIT_SETTLE_MS);
/** The idle window: the overlay open, zero input, frame counter watched. */
const IDLE_HOLD_MS = 5_000;
/**
 * Frames the demand loop is allowed to draw during the idle hold. Zero: the
 * scene behind the overlay must be fully asleep, not merely quiet.
 */
const IDLE_FRAME_BUDGET = 0;
/** Quiesce beat after each settled flag before a frame counter is trusted. */
const QUIESCE_MS = 800;
const POLL_MS = 250;
/** Escape presses before the unwind is declared stuck. */
const MAX_ESCAPES = 8;
/**
 * Whole-run watchdog: past this the browser is killed and the run fails.
 * Grows with the transit ceiling (three transit waits) so a longer
 * --reveal-timeout is not cut short by the watchdog.
 */
const WATCHDOG_MS =
  150_000 + 3 * Math.max(0, TRANSIT_SETTLE_MS - DEFAULT_TRANSIT_SETTLE_MS);

/* ---- browser discovery (update-history.mjs pattern) ----------------------- */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const SHELL_PATHS = [
  'chrome-headless-shell-mac-arm64/chrome-headless-shell',
  'chrome-headless-shell-mac-x64/chrome-headless-shell',
  'chrome-headless-shell-linux64/chrome-headless-shell',
  'chrome-linux/chrome',
];

function cachedShells() {
  const roots = [
    join(process.env.HOME ?? '', 'Library/Caches/ms-playwright'),
    join(process.env.HOME ?? '', '.cache/ms-playwright'),
  ];
  const found = [];

  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }

    for (const entry of readdirSync(root)) {
      for (const relative of SHELL_PATHS) {
        const candidate = join(root, entry, relative);

        if (existsSync(candidate)) {
          found.push(candidate);
        }
      }
    }
  }

  /* Newest build directory first — the names sort lexically by version. */
  return found.sort().reverse();
}

function findBrowser() {
  return (
    [...CHROME_CANDIDATES, ...cachedShells()].find((candidate) =>
      existsSync(candidate),
    ) ?? null
  );
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/* ---- CDP over the stdio pipe ---------------------------------------------- */

function openBrowser(binary) {
  const scratch = mkdtempSync(join(tmpdir(), 'journey-idle-'));
  const child = spawn(
    binary,
    [
      '--headless',
      '--remote-debugging-pipe',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      `--user-data-dir=${join(scratch, 'profile')}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  );

  const pending = new Map();
  const eventListeners = new Set();
  let buffer = Buffer.alloc(0);
  let sequence = 0;

  child.stdio[4].on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    for (let end = buffer.indexOf(0); end !== -1; end = buffer.indexOf(0)) {
      const raw = buffer.subarray(0, end).toString('utf8');
      buffer = buffer.subarray(end + 1);

      let message;

      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }

      if (message.id !== undefined) {
        const waiter = pending.get(message.id);

        if (waiter) {
          pending.delete(message.id);
          waiter(message.error ? null : message.result);
        }
      } else if (message.method) {
        eventListeners.forEach((listener) => listener(message));
      }
    }
  });

  function send(method, params, sessionId) {
    sequence += 1;
    const id = sequence;
    const frame = { id, method, params: params ?? {} };

    if (sessionId) {
      frame.sessionId = sessionId;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(null);
      }, 30_000);

      pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });

      try {
        child.stdio[3].write(`${JSON.stringify(frame)}\0`);
      } catch {
        clearTimeout(timer);
        pending.delete(id);
        resolve(null);
      }
    });
  }

  return {
    send,
    onEvent(listener) {
      eventListeners.add(listener);
    },
    close() {
      /* SIGKILL + profile cleanup: a headless shell must never outlive us. */
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }

      try {
        rmSync(scratch, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}

/* ---- page helpers --------------------------------------------------------- */

function makeEval(browser, session) {
  return async (expression) => {
    const result = await browser.send(
      'Runtime.evaluate',
      { expression, returnByValue: true },
      session,
    );
    return result?.result?.value;
  };
}

async function waitFor(evaluate, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if ((await evaluate(expression)) === true) {
      return;
    }

    await sleep(POLL_MS);
  }

  throw new Error(`timed out after ${timeoutMs}ms waiting for ${label}`);
}

async function pressEscape(browser, session) {
  const key = {
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  };
  await browser.send(
    'Input.dispatchKeyEvent',
    { type: 'keyDown', ...key },
    session,
  );
  await browser.send(
    'Input.dispatchKeyEvent',
    { type: 'keyUp', ...key },
    session,
  );
}

/*
 * Chatter that is not the journey's to answer for. The first block is Next
 * dev tooling; the second is pre-existing bench-load noise, attributed by
 * running this same check with the journey portal diff stashed out of
 * BenchScene.tsx (2026-09-01): the identical warnings arrive in the load
 * phase, before any journey interaction, with no journey 3D code present.
 * Everything else — every console error, and any warning outside these
 * patterns — still fails the run.
 */
const BENIGN_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /\[HMR\]/i,
  /webpack-hmr/i,
  /DevTools failed to load source map/i,
  /* SwiftShader/ANGLE performance chatter under software GL. */
  /GL Driver Message \(OpenGL, Performance/i,
  /* Pre-existing bench texture upload warnings (see attribution above). */
  /texSubImage2D: bad image data/i,
  /glTexImage2DRobustANGLE: Texture is immutable/i,
  /* Next dev font preloads outlive the load event on a slow software-GL page. */
  /was preloaded using link preload but not used/i,
];

const SETTLED = "document.documentElement.dataset.benchSettled === 'true'";
const OVERLAY_PRESENT =
  'document.querySelector(\'[role="dialog"][aria-modal="true"]\') !== null';
const FRAME_COUNT = 'window.__benchGL.info.render.frame';

/* ---- main ----------------------------------------------------------------- */

const result = {
  pass: false,
  url: `${ORIGIN}/?bench-debug=1`,
  f0: null,
  f1: null,
  f2: null,
  idleDelta: null,
  escapePresses: null,
  focusRestored: null,
  settledAfterClose: null,
  consoleIssues: [],
  journeyRouteStatus: null,
  error: null,
};

function finish(code) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(code);
}

async function main() {
  const binary = findBrowser();

  if (!binary) {
    throw new Error('no headless browser found (set CHROME_PATH)');
  }

  /* The direct route check needs no browser at all. */
  try {
    const response = await fetch(`${ORIGIN}/journey`, {
      signal: AbortSignal.timeout(15_000),
    });
    result.journeyRouteStatus = response.status;
  } catch (error) {
    result.journeyRouteStatus = `unreachable: ${error.message}`;
  }

  const browser = openBrowser(binary);
  const watchdog = setTimeout(() => {
    result.error = `watchdog: run exceeded ${WATCHDOG_MS}ms`;
    browser.close();
    finish(1);
  }, WATCHDOG_MS);

  try {
    const created = await browser.send('Target.createTarget', {
      url: 'about:blank',
    });

    if (!created?.targetId) {
      throw new Error('could not create a browser target');
    }

    const attached = await browser.send('Target.attachToTarget', {
      targetId: created.targetId,
      flatten: true,
    });
    const session = attached?.sessionId;

    if (!session) {
      throw new Error('could not attach to the browser target');
    }

    const evaluate = makeEval(browser, session);

    await browser.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
      session,
    );
    await browser.send('Page.enable', {}, session);
    /* Background tabs never composite; demand frames would stall without it. */
    await browser.send('Target.activateTarget', {
      targetId: created.targetId,
    });
    await browser.send('Runtime.enable', {}, session);
    await browser.send('Log.enable', {}, session);

    /* Console capture for the whole story, tagged by where in it we are. */
    let phase = 'load';
    browser.onEvent((message) => {
      if (message.sessionId !== session) {
        return;
      }

      if (message.method === 'Runtime.consoleAPICalled') {
        const { type, args } = message.params;

        if (type !== 'error' && type !== 'warning') {
          return;
        }

        const text = (args ?? [])
          .map((a) => a.value ?? a.description ?? '')
          .join(' ');

        if (!BENIGN_CONSOLE.some((pattern) => pattern.test(text))) {
          result.consoleIssues.push({
            phase,
            source: 'console',
            level: type,
            text,
          });
        }
      } else if (message.method === 'Log.entryAdded') {
        const { level, text } = message.params.entry;

        if (level !== 'error' && level !== 'warning') {
          return;
        }

        if (!BENIGN_CONSOLE.some((pattern) => pattern.test(text))) {
          result.consoleIssues.push({ phase, source: 'log', level, text });
        }
      }
    });

    /* 1. Load and settle. */
    await browser.send('Page.navigate', { url: result.url }, session);
    await waitFor(
      evaluate,
      `Boolean(window.__benchGL) && ${SETTLED}`,
      LOAD_SETTLE_MS,
      '__benchGL + initial benchSettled',
    );
    await sleep(QUIESCE_MS);
    result.f0 = await evaluate(FRAME_COUNT);

    phase = 'open';

    /* 2. Open the overlay through the DOM twin (focused first, so the
     *    overlay's focus restore has a real trigger to hand focus back to). */
    const clicked = await evaluate(
      `(() => {
        const twin = Array.from(
          document.querySelectorAll('button[aria-haspopup="dialog"]'),
        ).find((b) =>
          (b.getAttribute('aria-label') || '').startsWith('Open Tyler'),
        );
        if (!twin) return false;
        twin.focus();
        twin.click();
        return true;
      })()`,
    );

    if (clicked !== true) {
      throw new Error('journey DOM twin button not found');
    }

    await waitFor(
      evaluate,
      OVERLAY_PRESENT,
      TRANSIT_SETTLE_MS,
      'journey overlay to reveal',
    );
    await waitFor(
      evaluate,
      SETTLED,
      TRANSIT_SETTLE_MS,
      'benchSettled after the entry transit',
    );
    await sleep(QUIESCE_MS);

    phase = 'idle';

    /* 3. The idle proof: zero input, the frame counter must stand still. */
    result.f1 = await evaluate(FRAME_COUNT);
    await sleep(IDLE_HOLD_MS);
    result.f2 = await evaluate(FRAME_COUNT);
    result.idleDelta = result.f2 - result.f1;

    if (result.idleDelta > IDLE_FRAME_BUDGET) {
      throw new Error(
        `bench rendered ${result.idleDelta} frame(s) while the overlay was open and idle (budget ${IDLE_FRAME_BUDGET})`,
      );
    }

    phase = 'escape';

    /* 4. Escape unwinds the overlay closed. */
    let presses = 0;

    while (presses < MAX_ESCAPES) {
      await pressEscape(browser, session);
      presses += 1;
      await sleep(400);

      if ((await evaluate(OVERLAY_PRESENT)) === false) {
        break;
      }
    }

    result.escapePresses = presses;

    if ((await evaluate(OVERLAY_PRESENT)) !== false) {
      throw new Error(`overlay still open after ${MAX_ESCAPES} Escape presses`);
    }

    result.focusRestored = await evaluate(
      `(document.activeElement?.getAttribute('aria-label') || '').startsWith('Open Tyler')`,
    );

    if (result.focusRestored !== true) {
      throw new Error('focus did not return to the DOM twin after close');
    }

    phase = 'after-close';

    /* 5. The exit transit lands and the scene reports settled again. */
    await waitFor(
      evaluate,
      SETTLED,
      TRANSIT_SETTLE_MS,
      'benchSettled after the exit transit',
    );
    result.settledAfterClose = true;

    if (result.consoleIssues.length > 0) {
      throw new Error(
        `${result.consoleIssues.length} console error(s)/warning(s) captured`,
      );
    }

    if (result.journeyRouteStatus !== 200) {
      throw new Error(`/journey responded ${result.journeyRouteStatus}`);
    }

    result.pass = true;
  } catch (error) {
    result.error = error.message;
  } finally {
    clearTimeout(watchdog);
    browser.close();
  }

  finish(result.pass ? 0 : 1);
}

main().catch((error) => {
  result.error = error.message;
  finish(1);
});
