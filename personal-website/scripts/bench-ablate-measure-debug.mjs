#!/usr/bin/env node
/**
 * Debug version of the measurement script with logging at each step.
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const log = (msg) => console.error(`[${new Date().toISOString()}] ${msg}`);

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
const BINARY =
  args.binary ??
  join(
    homedir(),
    'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  );

log(
  `Starting measurement: url=${BASE_URL}, ablate=${ABLATE || '(none)'}, settle=${SETTLE_MS}ms`,
);

const pageUrl = `${BASE_URL}/?bench-debug=1${ABLATE ? `&ablate=${ABLATE}` : ''}`;
const profileDir = mkdtempSync(join(tmpdir(), 'bench-ablate-'));

log(`Page URL: ${pageUrl}`);
log(`Spawning Chromium: ${BINARY}`);

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
  log(`FAIL: ${message}`);
  try {
    browser.kill('SIGKILL');
  } catch {}
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {}
  process.exit(1);
}

const watchdog = setTimeout(() => fail('timeout after 90s'), 90_000);

const wsUrl = await new Promise((resolve, reject) => {
  log('Waiting for WebSocket URL from Chromium stderr...');
  let buffer = '';
  const timeout = setTimeout(() => {
    log('ERROR: Timeout waiting for WebSocket URL. Buffer so far:');
    log(buffer);
    reject(new Error('Timeout waiting for WebSocket URL'));
  }, 10000);

  browser.stderr.on('data', (chunk) => {
    buffer += chunk;
    log(`Got stderr chunk: ${chunk.toString().slice(0, 100)}`);
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) {
      clearTimeout(timeout);
      log(`Found WebSocket URL: ${match[1]}`);
      resolve(match[1]);
    }
  });

  browser.on('exit', (code, signal) => {
    clearTimeout(timeout);
    log(`Browser exited early with code ${code}, signal ${signal}`);
    log(`Final stderr buffer:\n${buffer}`);
    reject(
      new Error(
        `browser exited early (code ${code}, signal ${signal})\n${buffer}`,
      ),
    );
  });
}).catch((err) => {
  fail(`Failed to get WebSocket URL: ${err.message}`);
});

log(`Connecting to WebSocket: ${wsUrl}`);

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    log('ERROR: Timeout connecting to WebSocket');
    reject(new Error('Timeout connecting to WebSocket'));
  }, 5000);

  ws.onopen = () => {
    clearTimeout(timeout);
    log('WebSocket connected');
    resolve();
  };

  ws.onerror = (err) => {
    clearTimeout(timeout);
    log(`WebSocket error: ${err}`);
    reject(err);
  };
}).catch((err) => {
  fail(`WebSocket connection failed: ${err.message}`);
});

log('Setting up DevTools protocol...');

let nextId = 1;
const pending = new Map();
const eventWaiters = [];

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  } else if (message.method) {
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

const waitForEvent = (method) =>
  new Promise((resolve) => eventWaiters.push({ method, resolve }));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

log('Creating target...');
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
log(`Target created: ${targetId}`);

const { sessionId } = await send('Target.attachToTarget', {
  targetId,
  flatten: true,
});
log(`Session attached: ${sessionId}`);

await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Performance.enable', {}, sessionId);
log('Protocols enabled');

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

let rssPeakKb = 0;
const rssSamples = [];
const sampler = setInterval(() => {
  try {
    const rss = processTreeRssKb(browser.pid);
    rssSamples.push(rss);
    if (rss > rssPeakKb) rssPeakKb = rss;
  } catch {}
}, 500);

log(`Navigating to: ${pageUrl}`);
const loaded = waitForEvent('Page.loadEventFired');
await send('Page.navigate', { url: pageUrl }, sessionId);
log('Waiting for page load...');
await Promise.race([loaded, sleep(30_000)]);
log('Page load event received or timed out');

log('Waiting for scene to mount...');
for (let i = 0; i < 40; i++) {
  const mounted = await evaluate('Boolean(window.__benchGL)');
  if (mounted) {
    log(`Scene mounted at iteration ${i}`);
    break;
  }
  log(`Scene not ready at iteration ${i}, waiting...`);
  await sleep(500);
}

const sceneMounted = await evaluate('Boolean(window.__benchGL)');
log(`Final sceneMounted check: ${sceneMounted}`);

log(`Waiting for scene to settle (${SETTLE_MS}ms)...`);
await sleep(SETTLE_MS);
log('Scene settled');

log('Enabling HeapProfiler and collecting garbage...');
await send('HeapProfiler.enable', {}, sessionId).catch(() => {});
await send('HeapProfiler.collectGarbage', {}, sessionId).catch(() => {});
await sleep(1000);

log('Getting performance metrics...');
const { metrics } = await send('Performance.getMetrics', {}, sessionId);
const metric = (name) => metrics.find((entry) => entry.name === name)?.value;
log(`Got ${metrics.length} metrics`);

log('Evaluating GL info...');
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
log('GL info retrieved');

const rssSettledKb = processTreeRssKb(browser.pid);
log(`RSS settled: ${rssSettledKb}KB`);

if (SHOT_PATH) {
  log(`Taking screenshot to ${SHOT_PATH}...`);
  const { data } = await send(
    'Page.captureScreenshot',
    { format: 'png' },
    sessionId,
  );
  writeFileSync(SHOT_PATH, Buffer.from(data, 'base64'));
  log('Screenshot saved');
}

clearInterval(sampler);
clearTimeout(watchdog);

log('Outputting results...');

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

browser.kill('SIGKILL');
rmSync(profileDir, { recursive: true, force: true });
process.exit(0);

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
