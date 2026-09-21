#!/usr/bin/env node
/**
 * Minimal test to diagnose the hanging issue.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const log = (msg) =>
  console.error(`[${new Date().toISOString().split('T')[1]}] ${msg}`);

const BINARY = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);

const profileDir = mkdtempSync(join(tmpdir(), 'bench-test-'));

log('Spawning Chromium...');
const browser = spawn(
  BINARY,
  [
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

const wsUrl = await new Promise((resolve) => {
  let buffer = '';
  browser.stderr.on('data', (chunk) => {
    buffer += chunk;
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) {
      log(`Got WebSocket URL: ${match[1]}`);
      resolve(match[1]);
    }
  });
});

log('Connecting to WebSocket...');
const ws = new WebSocket(wsUrl);
await new Promise((resolve) => {
  ws.onopen = () => {
    log('WebSocket connected');
    resolve();
  };
});

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
    log(`Got event: ${message.method}`);
    for (let i = eventWaiters.length - 1; i >= 0; i--) {
      if (eventWaiters[i].method === message.method) {
        log(`  -> resolved waiter for ${message.method}`);
        eventWaiters[i].resolve(message.params);
        eventWaiters.splice(i, 1);
      }
    }
  }
};

function send(method, params = {}, sessionId) {
  const id = nextId++;
  log(`Sending: ${method}`);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const waitForEvent = (method) => {
  log(`  Waiting for event: ${method}`);
  return new Promise((resolve) => eventWaiters.push({ method, resolve }));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

log('Creating target...');
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });

log('Attaching to target...');
const { sessionId } = await send('Target.attachToTarget', {
  targetId,
  flatten: true,
});

log('Enabling protocols...');
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);

log('About to navigate...');
const loaded = waitForEvent('Page.loadEventFired');
log('Sending navigate...');
await send(
  'Page.navigate',
  { url: 'http://localhost:3100/?bench-debug=1' },
  sessionId,
);
log('Navigate sent, starting race...');

try {
  await Promise.race([
    (async () => {
      log('Waiting for loadEventFired...');
      const result = await loaded;
      log('Got loadEventFired!');
      return result;
    })(),
    (async () => {
      log('Starting 15s sleep...');
      await sleep(15_000);
      log('Sleep complete');
      return 'timeout';
    })(),
  ]);
  log('Race complete');
} catch (e) {
  log(`Race error: ${e.message}`);
}

log('Test complete');
browser.kill('SIGKILL');
rmSync(profileDir, { recursive: true, force: true });
process.exit(0);
