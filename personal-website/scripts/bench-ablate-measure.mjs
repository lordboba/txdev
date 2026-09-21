#!/usr/bin/env node
/**
 * Memory measurement harness for the bench scene's ablation flags.
 * Pass --verbose=true to expose browser startup and scene-mount progress.
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

const pageUrl = `${BASE_URL}/?bench-debug=1${ABLATE ? `&ablate=${ABLATE}` : ''}`;
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

const watchdog = setTimeout(() => fail('timeout after 180s'), 180_000);

/** Sum RSS (KB) of the browser process and all its descendants. */
function processTreeRssKb(rootPid) {
  const table = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number));
  const children = new Map();
  for (const [pid, ppid] of table) {
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  const rssByPid = new Map(table.map(([pid, , rss]) => [pid, rss]));
  let total = 0;
  const queue = [rootPid];
  while (queue.length) {
    const pid = queue.pop();
    total += rssByPid.get(pid) ?? 0;
    queue.push(...(children.get(pid) ?? []));
  }
  return total;
}

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

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true },
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

// Let animations settle
await sleep(SETTLE_MS);
log(`scene settled after ${SETTLE_MS}ms`);

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
  return {
    memory: gl.info.memory,
    programs: gl.info.programs.length,
    drawingBuffer: [context.drawingBufferWidth, context.drawingBufferHeight],
    devicePixelRatio: window.devicePixelRatio,
    estSceneTextureBytes: Math.round(estTextureBytes),
    sceneTextureCount: textures.size,
  };
})()`);

const rssSettledKb = processTreeRssKb(browser.pid);

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
      sceneMounted,
      rssPeakKb,
      rssSettledKb,
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
