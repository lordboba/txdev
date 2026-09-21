#!/usr/bin/env node
/**
 * Memory measurement harness for the bench scene's ablation flags.
 * Pass --verbose=true to expose browser startup and scene-mount progress.
 *
 * Optional state selection and timing, all additive to the ablation flags:
 *   --hash=profile|work|signals|history   settle on `#profile`, then transit to
 *                                         the view and wait for the settle flag
 *   --focus=work:0 | history:0            after the hash view settles, click the
 *                                         nth device / era card and settle again
 *   --sustained=<ms>                       force a frame per rAF for this long
 *                                         and report frame-interval p50/p95
 *   --idle=<ms>                            hands-off window after settle; the
 *                                         gl.render count inside it is reported
 *   --browser-args="--headless=new ..."    extra flags appended to the launch
 *
 * When --hash is given the WebGL allocations are counted at the API boundary
 * (texImage2D/texStorage2D/renderbufferStorage and their deletes), so the
 * texture bytes reported are what the GPU process actually holds rather than
 * an estimate from `scene.traverse`.
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  }),
);

const BASE_URL = args.url ?? 'http://localhost:3000';
const ABLATE = args.ablate ?? '';
const SETTLE_MS = Number(args.settle ?? 9000);
const SHOT_PATH = args.shot ?? null;
const VERBOSE = args.verbose === 'true';
const HASH = args.hash ?? null;
const FOCUS = args.focus ?? null;
const SUSTAINED_MS = Number(args.sustained ?? 0);
const IDLE_MS = Number(args.idle ?? 0);
const BROWSER_ARGS = (args['browser-args'] ?? '').split(/\s+/).filter(Boolean);
const SETTLE_TIMEOUT_MS = 60_000;
const UNSETTLE_TIMEOUT_MS = 2_000;

if (HASH && !['profile', 'work', 'signals', 'history'].includes(HASH)) {
  console.error(`unknown --hash view: ${HASH}`);
  process.exit(1);
}
if (FOCUS && !/^(work|history):\d+$/.test(FOCUS)) {
  console.error(`--focus expects work:<n> or history:<n>, got ${FOCUS}`);
  process.exit(1);
}
const BINARY =
  args.binary ??
  join(
    homedir(),
    'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  );

const log = (message) => {
  if (VERBOSE) {
    console.error(`[bench-ablate] ${message}`);
  }
};

const pageUrl = `${BASE_URL}/?bench-debug=1${ABLATE ? `&ablate=${ABLATE}` : ''}${HASH ? '#profile' : ''}`;
const profileDir = mkdtempSync(join(tmpdir(), 'bench-ablate-'));

log(`opening ${pageUrl}`);
log(`using browser ${BINARY}`);

const browser = spawn(
  BINARY,
  [
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--window-size=1440,900',
    '--force-device-scale-factor=2',
    ...BROWSER_ARGS,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

function fail(message) {
  console.error(message);
  try {
    browser.kill('SIGKILL');
  } catch {}
  try {
    rmSync(profileDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch {}
  process.exit(1);
}

const WATCHDOG_MS =
  180_000 + (HASH ? 2 * SETTLE_TIMEOUT_MS : 0) + SUSTAINED_MS + IDLE_MS;
const watchdog = setTimeout(
  () => fail(`timeout after ${WATCHDOG_MS / 1000}s`),
  WATCHDOG_MS,
);

/** pid -> { ppid, rss, command } for every process on the box. */
function processTable() {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,args='], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .map((line) => {
      const [pid, ppid, rss, ...command] = line.trim().split(/\s+/);
      return [Number(pid), { ppid: Number(ppid), rss: Number(rss), command }];
    });
}

/** The browser process and all of its descendants. */
function processTree(rootPid) {
  const table = processTable();
  const children = new Map();
  for (const [pid, { ppid }] of table) {
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  const byPid = new Map(table);
  const tree = [];
  const queue = [rootPid];
  while (queue.length) {
    const pid = queue.pop();
    const entry = byPid.get(pid);
    if (entry) tree.push(entry);
    queue.push(...(children.get(pid) ?? []));
  }
  return tree;
}

/** Sum RSS (KB) of the browser process and all its descendants. */
function processTreeRssKb(rootPid) {
  return processTree(rootPid).reduce((total, { rss }) => total + rss, 0);
}

/**
 * RSS (KB) of the GPU process and of the largest renderer, read off the
 * `--type=` switch each Chrome child carries. The renderer hosting the bench
 * is by far the biggest one, so the max is the page rather than about:blank.
 */
function processRolesRssKb(rootPid) {
  let gpu = 0;
  let renderer = 0;
  for (const { rss, command } of processTree(rootPid)) {
    if (command.includes('--type=gpu-process')) gpu += rss;
    if (command.includes('--type=renderer')) renderer = Math.max(renderer, rss);
  }
  return { gpu, renderer };
}

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const summarise = (intervals) => ({
  frames: intervals.length,
  p50: quantile(intervals, 0.5),
  p95: quantile(intervals, 0.95),
  max: intervals.length ? Math.max(...intervals) : null,
});

/**
 * Installed before any page script runs. Wraps the WebGL2 allocation entry
 * points so texture and renderbuffer bytes can be read back exactly, and
 * stamps the first draw call for time-to-first-draw.
 */
const GL_COUNTER_SOURCE = `(() => {
  const proto = WebGL2RenderingContext.prototype;
  const state = {
    firstDrawAt: null,
    drawCalls: 0,
    textureBytes: 0,
    textureCount: 0,
    renderbufferBytes: 0,
    renderbufferCount: 0,
  };
  window.__benchGLCounter = state;

  const BYTES_PER_TEXEL = {
    // sized internal formats
    0x8058: 4, // RGBA8
    0x8c43: 4, // SRGB8_ALPHA8
    0x8051: 3, // RGB8
    0x8c41: 3, // SRGB8
    0x8229: 1, // R8
    0x822b: 2, // RG8
    0x881a: 8, // RGBA16F
    0x881b: 6, // RGB16F
    0x822d: 2, // R16F
    0x822f: 4, // RG16F
    0x8814: 16, // RGBA32F
    0x8815: 12, // RGB32F
    0x822e: 4, // R32F
    0x8230: 8, // RG32F
    0x8c3a: 4, // R11F_G11F_B10F
    0x8d62: 2, // RGB565
    0x8056: 2, // RGBA4
    0x8057: 2, // RGB5_A1
    0x81a5: 2, // DEPTH_COMPONENT16
    0x81a6: 4, // DEPTH_COMPONENT24
    0x8cac: 4, // DEPTH_COMPONENT32F
    0x88f0: 4, // DEPTH24_STENCIL8
    0x8cad: 8, // DEPTH32F_STENCIL8
    0x8d48: 1, // STENCIL_INDEX8
    // unsized formats (WebGL1 style uploads)
    0x1908: 4, // RGBA
    0x1907: 3, // RGB
    0x1909: 1, // LUMINANCE
    0x190a: 2, // LUMINANCE_ALPHA
    0x1906: 1, // ALPHA
    0x1902: 4, // DEPTH_COMPONENT
    0x84f9: 4, // DEPTH_STENCIL
  };
  const TYPE_SCALE = { 0x140b: 2, 0x1406: 4 }; // HALF_FLOAT, FLOAT

  const texelBytes = (internalformat, type) => {
    const base = BYTES_PER_TEXEL[internalformat] ?? 4;
    // unsized formats take their depth from the pixel type
    if (internalformat <= 0x190a && TYPE_SCALE[type]) {
      return base * TYPE_SCALE[type];
    }
    return base;
  };

  const mipChainTexels = (width, height, levels) => {
    let total = 0;
    let w = width;
    let h = height;
    for (let level = 0; level < levels; level++) {
      total += w * h;
      if (w === 1 && h === 1) break;
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
    return total;
  };
  const fullChainLevels = (width, height) =>
    1 + Math.floor(Math.log2(Math.max(width, height)));

  const CUBE = 0x8513;
  const cubeTarget = (target) =>
    target >= 0x8515 && target <= 0x851a ? CUBE : target;

  // per-context binding state, keyed by the context object
  const contexts = new WeakMap();
  const bindings = (gl) => {
    let entry = contexts.get(gl);
    if (!entry) {
      entry = { unit: 0, textures: new Map(), renderbuffer: null };
      contexts.set(gl, entry);
    }
    return entry;
  };
  const boundTexture = (gl, target) =>
    bindings(gl).textures.get(bindings(gl).unit + ':' + cubeTarget(target)) ??
    null;

  // texture -> { levels: Map('level:face' -> bytes), width, height, mipmapped, storage }
  const textures = new Map();
  const renderbuffers = new WeakMap();
  state.inventory = () =>
    [...textures.values()]
      .map((entry) => ({
        width: entry.width,
        height: entry.height,
        faces: [...entry.levels.keys()].filter((key) => key.startsWith('0:')).length,
        bytes: Math.round(totalOf(entry)),
      }))
      .sort((a, b) => b.bytes - a.bytes);

  const record = (texture) => {
    let entry = textures.get(texture);
    if (!entry) {
      entry = { levels: new Map(), width: 0, height: 0, mipmapped: false, storage: 0 };
      textures.set(texture, entry);
      state.textureCount += 1;
    }
    return entry;
  };
  const totalOf = (entry) => {
    let bytes = entry.storage;
    let base = 0;
    let deeper = 0;
    for (const [key, value] of entry.levels) {
      bytes += value;
      if (key.startsWith('0:')) base += value;
      else deeper += value;
    }
    // generateMipmap on a level-0-only texture: charge the full chain
    if (entry.mipmapped && deeper === 0 && entry.width) {
      const { width, height } = entry;
      bytes += base * (mipChainTexels(width, height, fullChainLevels(width, height)) / (width * height) - 1);
    }
    return bytes;
  };
  const setLevel = (entry, level, face, bytes, width, height) => {
    const before = totalOf(entry);
    entry.levels.set(level + ':' + face, bytes);
    if (level === 0) {
      entry.width = width;
      entry.height = height;
    }
    state.textureBytes += totalOf(entry) - before;
  };

  const wrap = (name, fn) => {
    const original = proto[name];
    if (!original) return;
    proto[name] = function (...args) {
      const result = original.apply(this, args);
      try {
        fn.call(this, args);
      } catch {}
      return result;
    };
  };

  wrap('activeTexture', function ([unit]) {
    bindings(this).unit = unit - 0x84c0;
  });
  wrap('bindTexture', function ([target, texture]) {
    const entry = bindings(this);
    entry.textures.set(entry.unit + ':' + cubeTarget(target), texture);
  });
  wrap('bindRenderbuffer', function ([, renderbuffer]) {
    bindings(this).renderbuffer = renderbuffer;
  });

  const sourceSize = (source) => {
    if (!source) return [0, 0];
    return [
      source.videoWidth ?? source.naturalWidth ?? source.width ?? 0,
      source.videoHeight ?? source.naturalHeight ?? source.height ?? 0,
    ];
  };

  wrap('texImage2D', function (args) {
    const texture = boundTexture(this, args[0]);
    if (!texture) return;
    const level = args[1];
    const internalformat = args[2];
    let width;
    let height;
    let type;
    if (args.length === 6) {
      [width, height] = sourceSize(args[5]);
      type = args[4];
    } else {
      width = args[3];
      height = args[4];
      type = args[7];
    }
    const face = cubeTarget(args[0]) === CUBE ? args[0] - 0x8515 : 0;
    const bpt = texelBytes(internalformat, type);
    setLevel(record(texture), level, face, width * height * bpt, width, height);
  });

  wrap('texStorage2D', function ([target, levels, internalformat, width, height]) {
    const texture = boundTexture(this, target);
    if (!texture) return;
    const faces = cubeTarget(target) === CUBE ? 6 : 1;
    const bpt = texelBytes(internalformat);
    const entry = record(texture);
    const before = totalOf(entry);
    entry.storage = mipChainTexels(width, height, levels) * bpt * faces;
    entry.width = width;
    entry.height = height;
    state.textureBytes += totalOf(entry) - before;
  });

  wrap('compressedTexImage2D', function (args) {
    const texture = boundTexture(this, args[0]);
    if (!texture) return;
    const data = args[6];
    const bytes = typeof data === 'number' ? data : data?.byteLength ?? 0;
    const face = cubeTarget(args[0]) === CUBE ? args[0] - 0x8515 : 0;
    setLevel(record(texture), args[1], face, bytes, args[3], args[4]);
  });

  wrap('generateMipmap', function ([target]) {
    const texture = boundTexture(this, target);
    if (!texture) return;
    const entry = record(texture);
    if (entry.storage) return; // texStorage2D already reserved the chain
    const before = totalOf(entry);
    entry.mipmapped = true;
    state.textureBytes += totalOf(entry) - before;
  });

  wrap('deleteTexture', function ([texture]) {
    const entry = texture && textures.get(texture);
    if (!entry) return;
    state.textureBytes -= totalOf(entry);
    state.textureCount -= 1;
    textures.delete(texture);
  });

  const storeRenderbuffer = function (internalformat, width, height, samples) {
    const renderbuffer = bindings(this).renderbuffer;
    if (!renderbuffer) return;
    const bytes = width * height * texelBytes(internalformat) * Math.max(1, samples);
    const previous = renderbuffers.get(renderbuffer);
    if (previous === undefined) state.renderbufferCount += 1;
    state.renderbufferBytes += bytes - (previous ?? 0);
    renderbuffers.set(renderbuffer, bytes);
  };
  wrap('renderbufferStorage', function ([, internalformat, width, height]) {
    storeRenderbuffer.call(this, internalformat, width, height, 1);
  });
  wrap('renderbufferStorageMultisample', function ([, samples, internalformat, width, height]) {
    storeRenderbuffer.call(this, internalformat, width, height, samples);
  });
  wrap('deleteRenderbuffer', function ([renderbuffer]) {
    const bytes = renderbuffer && renderbuffers.get(renderbuffer);
    if (bytes === undefined) return;
    state.renderbufferBytes -= bytes;
    state.renderbufferCount -= 1;
    renderbuffers.delete(renderbuffer);
  });

  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
    wrap(name, function () {
      state.drawCalls += 1;
      if (state.firstDrawAt === null) state.firstDrawAt = performance.now();
    });
  }
})();`;

/**
 * Runs in the page once the renderer exists: wraps `gl.render` so every frame
 * the scene actually draws is timestamped, and exposes the demand-loop
 * invalidator for the sustained-frame probe.
 */
const RENDER_TAP_SOURCE = `(() => {
  const gl = window.__benchGL;
  if (!gl || gl.__benchTapped) return;
  gl.__benchTapped = true;
  const tap = { stamps: [] };
  window.__benchRenderTap = tap;
  const render = gl.render.bind(gl);
  gl.render = (...args) => {
    tap.stamps.push(performance.now());
    return render(...args);
  };
})();`;

const wsUrl = await new Promise((resolve, reject) => {
  let buffer = '';
  const timeout = setTimeout(() => {
    reject(new Error(`browser did not expose a DevTools URL\n${buffer}`));
  }, 10_000);

  const onExit = (code, signal) => {
    clearTimeout(timeout);
    browser.off('error', onError);
    reject(
      new Error(
        `browser exited before startup (code ${code}, signal ${signal})\n${buffer}`,
      ),
    );
  };
  const onError = (error) => {
    clearTimeout(timeout);
    browser.off('exit', onExit);
    reject(error);
  };

  browser.stderr.on('data', (chunk) => {
    buffer += chunk;
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) {
      clearTimeout(timeout);
      browser.off('exit', onExit);
      browser.off('error', onError);
      resolve(match[1]);
    }
  });
  browser.once('exit', onExit);
  browser.once('error', onError);
}).catch((error) => fail(error.message));

log('browser started');

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error('DevTools WebSocket connection timed out')),
    5_000,
  );

  ws.onopen = () => {
    clearTimeout(timeout);
    resolve();
  };
  ws.onerror = (error) => {
    clearTimeout(timeout);
    reject(error);
  };
}).catch((error) => fail(`DevTools connection failed: ${error.message}`));

log('DevTools connected');

let nextId = 1;
const pending = new Map();
const eventWaiters = [];
/** Page console errors/warnings and uncaught exceptions, for the mount-timeout report. */
const consoleIssues = [];

function recordConsoleIssue(message) {
  if (message.method === 'Runtime.consoleAPICalled') {
    const { type, args } = message.params;
    if (type !== 'error' && type !== 'warning') return;
    const text = (args ?? [])
      .map((arg) => arg.value ?? arg.description ?? '')
      .join(' ');
    consoleIssues.push(`console.${type}: ${text}`);
  } else if (message.method === 'Runtime.exceptionThrown') {
    const { exceptionDetails } = message.params;
    const text =
      exceptionDetails.exception?.description ?? exceptionDetails.text;
    consoleIssues.push(`uncaught: ${text}`);
  } else if (message.method === 'Log.entryAdded') {
    const { level, source, text, url } = message.params.entry;
    if (level !== 'error' && level !== 'warning') return;
    consoleIssues.push(`${source} ${level}: ${text}${url ? ` (${url})` : ''}`);
  }
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  } else if (message.method) {
    recordConsoleIssue(message);
    for (let i = eventWaiters.length - 1; i >= 0; i--) {
      if (eventWaiters[i].method === message.method) {
        eventWaiters[i].resolve(message.params);
        eventWaiters.splice(i, 1);
      }
    }
  }
};

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', {
  targetId,
  flatten: true,
});

await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId).catch(() => {});
await send('Performance.enable', {}, sessionId);
if (HASH) {
  await send(
    'Page.addScriptToEvaluateOnNewDocument',
    { source: GL_COUNTER_SOURCE },
    sessionId,
  );
}

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (exceptionDetails) {
    throw new Error(
      `page evaluate failed: ${JSON.stringify(exceptionDetails)}`,
    );
  }
  return result.value;
};

// RSS sampler runs across the whole page lifetime to catch the load spike.
let rssPeakKb = 0;
const rssSamples = [];
const sampler = setInterval(() => {
  try {
    const rss = processTreeRssKb(browser.pid);
    rssSamples.push(rss);
    if (rss > rssPeakKb) rssPeakKb = rss;
  } catch {}
}, 500);

/**
 * Why the scene did not mount: does the route answer, what did the page log,
 * and did `?bench-debug=1` (which gates `window.__benchGL`) reach the page.
 */
async function mountDiagnostics() {
  let routeStatus;
  try {
    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    routeStatus = `${response.status} ${response.statusText}`.trim();
  } catch (error) {
    routeStatus = `unreachable: ${error.message}`;
  }

  const page = await evaluate(`({
    href: location.href,
    readyState: document.readyState,
    benchDebug: new URLSearchParams(location.search).get('bench-debug'),
    canvases: document.querySelectorAll('canvas').length,
  })`).catch((error) => ({ error: error.message }));

  const lines = [
    `  route: GET ${pageUrl} -> ${routeStatus}`,
    `  page: ${JSON.stringify(page)}`,
    `  bench-debug flag reached the page: ${page.benchDebug === '1' ? 'yes' : 'no'}`,
    `  console issues (${consoleIssues.length}):`,
    ...(consoleIssues.length
      ? consoleIssues.slice(-20).map((issue) => `    ${issue}`)
      : ['    (none)']),
  ];
  return lines.join('\n');
}

// Navigate and wait for scene to mount (skip Page.loadEventFired which doesn't fire in headless)
await send('Page.navigate', { url: pageUrl }, sessionId);
log('page navigation started');

// Wait for the scene to mount, polling every 500ms for up to 60 seconds
for (let i = 0; i < 120; i++) {
  if (await evaluate('Boolean(window.__benchGL)')) break;
  await sleep(500);
}
const sceneMounted = await evaluate('Boolean(window.__benchGL)');
if (!sceneMounted) {
  fail(
    `bench scene did not mount within 60 seconds\n${await mountDiagnostics()}`,
  );
}
log('bench scene mounted');

/**
 * Wait for `data-bench-settled` to flip true, returning the wall time it took
 * and the gl.render intervals recorded on the way (the transit frames).
 */
const waitForSettle = async (label) => {
  const startedAt = Date.now();
  const stampsBefore = await evaluate(
    'window.__benchRenderTap ? window.__benchRenderTap.stamps.length : 0',
  );
  // the flag flips false on the next rendered frame, not synchronously, and
  // on software GL a frame is ~100ms — poll for the flip rather than guess
  const unsettleDeadline = Date.now() + UNSETTLE_TIMEOUT_MS;
  let moved = false;
  while (Date.now() < unsettleDeadline) {
    if (
      await evaluate("document.documentElement.dataset.benchSettled !== 'true'")
    ) {
      moved = true;
      break;
    }
    await sleep(25);
  }
  if (!moved) log(`${label}: bench never left settled state`);
  let settled = false;
  while (Date.now() - startedAt < SETTLE_TIMEOUT_MS) {
    settled = await evaluate(
      "document.documentElement.dataset.benchSettled === 'true'",
    );
    if (settled) break;
    await sleep(100);
  }
  if (!settled) fail(`${label}: bench did not settle within 60s`);
  const stamps = await evaluate(
    `window.__benchRenderTap ? window.__benchRenderTap.stamps.slice(${stampsBefore}) : []`,
  );
  const intervals = stamps.slice(1).map((stamp, i) => stamp - stamps[i]);
  const result = { settleMs: Date.now() - startedAt, ...summarise(intervals) };
  log(`${label}: settled in ${result.settleMs}ms over ${result.frames} frames`);
  return result;
};

/**
 * Locate the nth clickable device / era card by the view name baked into
 * its hover handler, and fire its onClick the way a pointer hit would.
 */
const focusExpression = (view, index) => `(() => {
  const hits = [];
  window.__benchScene.traverse((object) => {
    const handlers = object.__r3f && object.__r3f.handlers;
    if (!handlers || !handlers.onClick || !handlers.onPointerLeave) return;
    const source = String(handlers.onPointerEnter) + String(handlers.onPointerLeave);
    if (/["']${view}["']/.test(source)) hits.push(object);
  });
  const target = hits[${index}];
  if (!target) return { found: hits.length };
  target.__r3f.handlers.onClick({
    stopPropagation() {},
    nativeEvent: { target: null },
    object: target,
  });
  return { found: hits.length, clicked: true };
})()`;

let transit = null;
let focusTransit = null;
let firstDrawMs = null;

if (HASH) {
  await evaluate(RENDER_TAP_SOURCE);
  const intro = await waitForSettle('intro');
  log(`intro settled in ${intro.settleMs}ms`);
  if (HASH !== 'profile') {
    await evaluate(`window.location.hash = '${HASH}'`);
    transit = await waitForSettle(`#${HASH}`);
  }
  if (FOCUS) {
    const [view, index] = FOCUS.split(':');
    const outcome = await evaluate(focusExpression(view, Number(index)));
    if (!outcome.clicked) {
      fail(`--focus=${FOCUS}: only ${outcome.found} ${view} targets found`);
    }
    focusTransit = await waitForSettle(`focus ${FOCUS}`);
  }
  firstDrawMs = await evaluate('window.__benchGLCounter.firstDrawAt');
} else {
  // Let animations settle
  await sleep(SETTLE_MS);
  log(`scene settled after ${SETTLE_MS}ms`);
}

let sustained = null;
if (SUSTAINED_MS > 0) {
  await evaluate(RENDER_TAP_SOURCE);
  const stampsBefore = await evaluate('window.__benchRenderTap.stamps.length');
  await evaluate(`new Promise((resolve) => {
    const invalidate = window.__benchScene.__r3f.root.getState().invalidate;
    const until = performance.now() + ${SUSTAINED_MS};
    const tick = () => {
      invalidate();
      if (performance.now() < until) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  })`);
  const stamps = await evaluate(
    `window.__benchRenderTap.stamps.slice(${stampsBefore})`,
  );
  sustained = summarise(stamps.slice(1).map((stamp, i) => stamp - stamps[i]));
  log(`sustained: ${sustained.frames} frames, p95 ${sustained.p95}ms`);
  // the forced loop leaves a couple of frames in flight; let them land
  await sleep(500);
}

let idle = null;
if (IDLE_MS > 0) {
  await evaluate(RENDER_TAP_SOURCE);
  const stampsBefore = await evaluate('window.__benchRenderTap.stamps.length');
  await sleep(IDLE_MS);
  const renders = await evaluate(
    `window.__benchRenderTap.stamps.length - ${stampsBefore}`,
  );
  idle = { windowMs: IDLE_MS, renderCalls: renders };
  log(`idle: ${renders} gl.render calls in ${IDLE_MS}ms`);
}

await send('HeapProfiler.enable', {}, sessionId).catch(() => {});
await send('HeapProfiler.collectGarbage', {}, sessionId).catch(() => {});
await sleep(1000);

const { metrics } = await send('Performance.getMetrics', {}, sessionId);
const metric = (name) => metrics.find((entry) => entry.name === name)?.value;

const glInfo = await evaluate(`(() => {
  const gl = window.__benchGL;
  const scene = window.__benchScene;
  if (!gl || !scene) return null;
  const textures = new Set();
  scene.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const key in material) {
        const value = material[key];
        if (value && value.isTexture && value.image) textures.add(value);
      }
    }
  });
  let estTextureBytes = 0;
  for (const texture of textures) {
    const image = texture.image;
    const width = image.width ?? 0;
    const height = image.height ?? 0;
    let bytes = width * height * 4;
    if (texture.generateMipmaps !== false) bytes *= 4 / 3;
    estTextureBytes += bytes;
  }
  const context = gl.getContext();
  const counter = window.__benchGLCounter ?? null;
  return {
    memory: gl.info.memory,
    programs: gl.info.programs.length,
    drawCalls: gl.info.render.calls,
    drawingBuffer: [context.drawingBufferWidth, context.drawingBufferHeight],
    devicePixelRatio: window.devicePixelRatio,
    estSceneTextureBytes: Math.round(estTextureBytes),
    sceneTextureCount: textures.size,
    gpuTextureBytes: counter ? Math.round(counter.textureBytes) : null,
    gpuTextureCount: counter ? counter.textureCount : null,
    gpuRenderbufferBytes: counter ? Math.round(counter.renderbufferBytes) : null,
    gpuRenderbufferCount: counter ? counter.renderbufferCount : null,
    gpuTextures: counter ? counter.inventory() : null,
  };
})()`);

const rssSettledKb = processTreeRssKb(browser.pid);
const rssRoles = processRolesRssKb(browser.pid);

if (SHOT_PATH) {
  const { data } = await send(
    'Page.captureScreenshot',
    { format: 'png' },
    sessionId,
  );
  writeFileSync(SHOT_PATH, Buffer.from(data, 'base64'));
}

clearInterval(sampler);
clearTimeout(watchdog);

console.log(
  JSON.stringify(
    {
      ablate: ABLATE || '(baseline)',
      url: pageUrl,
      hash: HASH,
      focus: FOCUS,
      sceneMounted,
      rssPeakKb,
      rssSettledKb,
      rssGpuProcessKb: rssRoles.gpu,
      rssRendererKb: rssRoles.renderer,
      firstDrawMs,
      transit,
      focusTransit,
      sustained,
      idle,
      rssSamplesKb: rssSamples,
      jsHeapUsedBytes: metric('JSHeapUsedSize'),
      jsHeapTotalBytes: metric('JSHeapTotalSize'),
      glInfo,
      screenshot: SHOT_PATH,
    },
    null,
    2,
  ),
);

const browserExited = new Promise((resolve) => browser.once('exit', resolve));
browser.kill('SIGKILL');
await Promise.race([browserExited, sleep(5000)]);

try {
  rmSync(profileDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
} catch (error) {
  console.error(
    `[bench-ablate] warning: unable to remove browser profile: ${error.message}`,
  );
}
process.exit(0);
