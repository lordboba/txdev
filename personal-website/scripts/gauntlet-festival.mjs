/**
 * Mid-Autumn festival gauntlet (bible §7.7): captures every named state and
 * runs every assertion that can be automated, prints a PASS/FAIL table with
 * the measured values, writes the §7.5 perf rows to JSON, and exits non-zero
 * on any failure.
 *
 * Usage:
 *   node scripts/gauntlet-festival.mjs --url http://localhost:3000 --out <dir>
 *
 * Options:
 *   --url       dev server (default http://localhost:3000; NEVER turbopack)
 *   --out       PNG directory (default <scratchpad>/shots/festival-gauntlet)
 *   --perf-out  perf JSON path (default <scratchpad>/shots/festival-perf.json)
 *   --off-url   a second server started with NEXT_PUBLIC_FESTIVAL=0, for the
 *               `enabled: false` half of the kill-switch check (optional)
 *   --only      comma list of route substrings to run (default: all)
 *   --quick     skip the 20 s period sampling, the pointer sweep, the colour
 *               themes and the GPU timing pass (smoke run)
 *   --timing    gpu | off (default gpu: a second, non-SwiftShader browser is
 *               tried for the §7.5 frame-timing rows; when its renderer string
 *               still says SwiftShader those rows are SKIPPED and say so)
 *
 * Modelled on scripts/capture-bench.mjs. playwright-core is loaded from the
 * scratchpad install (PLAYWRIGHT_CORE_DIR overrides the path); Chromium is the
 * newest cached Playwright build. Captures run on SwiftShader with
 * `?festival-seed=7` so pixels are stable run to run.
 *
 * How the script reads the layer (all documented in the bible / CONTRACTS.md):
 * - `html[data-festival="mid-autumn"]`, `html[data-festival-settled="true"]`
 * - `window.__festival` under `?bench-debug=1`: wind(t), rendererInfo(),
 *   theta(), frames(), layout(); optional extras it uses when present:
 *   time() (sim seconds), state() (SimState), scheduleGust()
 * - overlay root: `[data-festival-root]` if the layer marks it, otherwise the
 *   parent of the one canvas that is not inside <main>
 * - overlay text: CSS-module local names (`slip`, `strip`, `card`, `figure`,
 *   `column`, `glyph`, `caption`, `translation`, `pinyin`, `colophon`, `moon`)
 *   matched by `[class*=...]`, plus the real roles: `button[aria-expanded]`
 *   (slip), `button[aria-label^="Full moon"]` (moon), `figure` (poem)
 * - CSS custom properties on the overlay root: --moon-x/-y/-d, --poem-theta,
 *   --slip-theta, --festival-pool-tint (see FESTIVAL_CSS_VARS)
 *
 * Every step is guarded: a missing layer, element or API produces a FAIL (or
 * a SKIP that says why), never a crash.
 */
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, arr) =>
      a.startsWith('--')
        ? [a.slice(2), arr[i + 1]?.startsWith('--') ? '1' : (arr[i + 1] ?? '1')]
        : null,
    )
    .filter(Boolean),
);

const SCRATCH =
  '/private/tmp/claude-501/-Users-tylerxiao-Documents-txdev-personal-website/bc50ff0d-9a63-407c-be34-359f7849e09c/scratchpad';
const BASE_URL = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const OFF_URL = args['off-url']?.replace(/\/$/, '') ?? null;
const OUT = resolve(args.out ?? join(SCRATCH, 'shots', 'festival-gauntlet'));
const PERF_OUT = resolve(
  args['perf-out'] ?? join(SCRATCH, 'shots', 'festival-perf.json'),
);
const ONLY = args.only ? args.only.split(',').map((s) => s.trim()) : null;
const QUICK = args.quick === '1';
const TIMING = QUICK ? 'off' : (args.timing ?? 'gpu');
const SEED = 7;

mkdirSync(OUT, { recursive: true });
mkdirSync(dirname(PERF_OUT), { recursive: true });

// ---------------------------------------------------------------------------
// playwright-core + Chromium (as capture-bench.mjs, from the scratchpad)
// ---------------------------------------------------------------------------

async function loadPlaywright() {
  const dir = process.env.PLAYWRIGHT_CORE_DIR ?? join(SCRATCH, 'pw');
  const entry = join(dir, 'node_modules', 'playwright-core', 'index.mjs');
  if (existsSync(entry)) return import(pathToFileURL(entry).href);
  try {
    return await import('playwright-core');
  } catch {
    throw new Error(
      `playwright-core not found at ${entry}; install it there or set PLAYWRIGHT_CORE_DIR`,
    );
  }
}

function chromiumExecutable() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const build = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .at(-1);
  if (!build) {
    throw new Error(
      'No cached Chromium build; run: npx playwright-core install chromium',
    );
  }
  return join(
    cache,
    build,
    'chrome-mac-arm64',
    'Google Chrome for Testing.app',
    'Contents',
    'MacOS',
    'Google Chrome for Testing',
  );
}

const SWIFTSHADER_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
const COMMON_ARGS = ['--enable-precise-memory-info'];

// ---------------------------------------------------------------------------
// Foundation modules (Node 24 strips types): expected rects, tints, timings.
// Loaded defensively so the gauntlet still runs when a module is broken.
// ---------------------------------------------------------------------------

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function loadFoundation() {
  const mod = async (rel) => {
    try {
      return await import(pathToFileURL(join(PROJECT, rel)).href);
    } catch (err) {
      console.warn(`[foundation] ${rel} failed to load: ${err.message}`);
      return null;
    }
  };
  return {
    palette: await mod('components/festival/palette.ts'),
    layout: await mod('components/festival/scene/layout.ts'),
    types: await mod('components/festival/scene/types.ts'),
    projectData: await mod('content/projectData.ts'),
  };
}

// ---------------------------------------------------------------------------
// Matrix (bible §7.7): routes × viewports × themes (+ colour themes on /blog)
// ---------------------------------------------------------------------------

const ROUTES = [
  { path: '/', key: 'home' },
  { path: '/orbital', key: 'orbital' },
  { path: '/blog', key: 'blog' },
  { path: '/blog/introduction', key: 'blog-slug' },
  { path: '/past-experience', key: 'past-experience' },
  { path: '/schedule-a-call', key: 'schedule-a-call' },
];
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, dsf: 2, mobile: false },
  mobile: { width: 390, height: 844, dsf: 2, mobile: true },
};
const THEMES = ['dark', 'light'];
const COLOUR_THEMES = ['mono', 'ember', 'ice', 'terminal'];
const MOUNT_STATES_MS = [500, 1500, 2600];
const GUST_STATE_MS = 5000;

// Bible numbers used as thresholds.
const SETTLE_GATE_MS = 4500; // §7.5
const TRANSLATION_WINDOW_MS = [2400, 3600]; // M2
const LAST_POEM_GLYPH_MS = 2240; // M2
const FIRST_GUST_S = 4.4; // §4.5
const GUST_SPEED_VW = 0.55;
const GUST_TOLERANCE_MS = 120; // M3 front arrival
const GUST_ONSET_TOLERANCE_MS = 150; // M3 onset spacing (θ moves > 0.15°)
const PERIOD_TOLERANCE = 0.08; // M4
const SWEEP_PX_PER_S = 1200; // M5
const HALO_WIDTH_FACTOR = 2.8; // §2.2
const POOL_WIDTH_FACTOR = 3.2;
const POOL_ASPECT = 1.35;
const POOL_DROP_BODY_HEIGHTS = 0.4;

// ---------------------------------------------------------------------------
// Result registry
// ---------------------------------------------------------------------------

const results = [];
const perf = { generatedAt: new Date().toISOString(), url: BASE_URL, rows: [] };

function record(status, id, label, measured, expected, note) {
  results.push({ status, id, label, measured, expected, note });
  const tag = status.padEnd(4);
  console.log(
    `${tag} ${id.padEnd(30)} ${String(measured ?? '')
      .slice(0, 60)
      .padEnd(60)} ${note ? '· ' + note : ''}`,
  );
}
const pass = (id, label, measured, expected, note) =>
  record('PASS', id, label, measured, expected, note);
const fail = (id, label, measured, expected, note) =>
  record('FAIL', id, label, measured, expected, note);
const skip = (id, label, why) => record('SKIP', id, label, '', '', why);
const check = (ok, id, label, measured, expected, note) =>
  (ok ? pass : fail)(id, label, measured, expected, note);

function perfRow(metric, route, measured, budget, ok, note) {
  perf.rows.push({ metric, route, measured, budget, pass: ok, note });
  if (ok === null) skip(`perf:${metric}@${route}`, metric, note);
  else check(ok, `perf:${metric}@${route}`, metric, measured, budget, note);
}

/** Runs a step; any throw becomes a FAIL for `id` instead of a crash. */
async function guarded(id, fn) {
  try {
    return await fn();
  } catch (err) {
    fail(id, id, `threw: ${String(err.message ?? err).slice(0, 120)}`, '', '');
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Colour maths (node side)
// ---------------------------------------------------------------------------

const hexRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const fmt = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : String(n));

// ---------------------------------------------------------------------------
// In-page helpers (serialised by Playwright; must be self-contained)
// ---------------------------------------------------------------------------

/**
 * Installed before any page script (so `document.documentElement` may not
 * exist yet: everything observes `document`): a timeline recorder (mount,
 * settled, text reveals) in wall ms and, when `window.__festival.time()` is
 * available, in sim seconds, a WebGL-context counter, LCP and long-task
 * observers. Helpers are installed before the observer so nothing can strip
 * them.
 */
function initScript() {
  const g = (window.__gauntlet = {
    t: {},
    /** The same marks in sim seconds (the bible's unit; SwiftShader runs slow). */
    sim: {},
    shown: [],
    webgl: 0,
    lcp: [],
    longTasks: 0,
  });
  const simNow = () => {
    try {
      const v = window.__festival?.time?.();
      return typeof v === 'number' ? v : undefined;
    } catch {
      return undefined;
    }
  };
  const mark = (k) => {
    if (!(k in g.t)) {
      g.t[k] = performance.now();
      const st = simNow();
      if (st !== undefined) g.sim[k] = st;
    }
  };
  /** §4.1 t0: canvas exists AND fonts.ready resolved or 800 ms elapsed. */
  g.t0 = () => {
    const c = g.t.canvas;
    if (c === undefined) return undefined;
    const f = g.t.fontsReady;
    return Math.max(c, Math.min(f ?? Infinity, c + 800));
  };
  /**
   * Time since mount, ms. Sim time when the layer exposes it (the wind clock
   * starts at 0 on a fresh page and runs from t0): the bible's numbers hold
   * on SwiftShader at 3 fps as on a GPU. Wall time otherwise.
   */
  g.now = () => {
    const st = simNow();
    if (st !== undefined) return st * 1000;
    const t0 = g.t0();
    return t0 === undefined ? undefined : performance.now() - t0;
  };
  g.simNow = simNow;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    // Detached probe canvases (useWebGLSupport) are not page contexts.
    if (
      ctx &&
      /webgl/i.test(String(type)) &&
      !this.__gauntletCounted &&
      this.isConnected
    ) {
      this.__gauntletCounted = true;
      g.webgl += 1;
    }
    return ctx;
  };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const el = e.element;
        g.lcp.push({
          t: e.startTime,
          size: e.size,
          element: el
            ? `${el.tagName}${el.id ? '#' + el.id : ''}:${(el.textContent || '').trim().slice(0, 32)}`
            : null,
        });
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      g.longTasks += list.getEntries().length;
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  document.fonts?.ready.then(() => mark('fontsReady'));

  const kindOf = (el) => {
    const cls = String(el.className || '');
    for (const k of ['slip', 'caption', 'colophon', 'column', 'figure']) {
      if (new RegExp(`(^|[_\\s-])${k}(__|_|\\s|$)`).test(cls)) return k;
    }
    return el.tagName.toLowerCase();
  };
  new MutationObserver((muts) => {
    const root = document.documentElement;
    for (const m of muts) {
      if (m.type === 'attributes') {
        const el = m.target;
        const name = m.attributeName;
        if (el === root) {
          if (name === 'data-festival' && el.hasAttribute(name))
            mark('festival');
          if (name === 'data-festival-settled') {
            if (el.getAttribute(name) === 'true') {
              mark('settled');
              g.t.settledLast = performance.now();
            } else g.t.settledCleared = performance.now();
          }
        } else if (name === 'data-shown') {
          if (el.getAttribute('data-shown') === 'true') {
            const k = kindOf(el);
            mark('shown:' + k);
            g.shown.push({ k, t: performance.now(), sim: simNow() });
          }
        } else if (name === 'data-text') {
          mark('text:' + el.getAttribute('data-text'));
          g.t.textLast = performance.now();
        }
      } else {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const canvases = n.matches?.('canvas')
            ? [n]
            : [...(n.querySelectorAll?.('canvas') ?? [])];
          if (canvases.some((c) => !c.closest('main'))) mark('canvas');
        }
      }
    }
    // A Document is a Node; documentElement is null at init-script time.
  }).observe(document, {
    attributes: true,
    subtree: true,
    childList: true,
    attributeFilter: [
      'data-festival',
      'data-festival-settled',
      'data-shown',
      'data-text',
    ],
  });
}

/** Everything the node side wants to know about the live overlay. */
function readOverlay() {
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const canvas = qa('canvas').find((c) => !c.closest('main')) ?? null;
  // Fixed wrapper (canvas + overlay); the overlay `.root` is its non-canvas child.
  const root =
    q('[data-festival-root]') ?? (canvas ? canvas.parentElement : null);
  const overlay = root
    ? ([...root.children].find((el) => el.tagName !== 'CANVAS') ?? root)
    : null;
  const cs = (el) => (el ? getComputedStyle(el) : null);
  // The wrapper is `display: contents`; the fixed canvas root carries the z.
  const rootStyle = cs(canvas ? canvas.parentElement : root);
  // Custom properties are written on the overlay root; fall back outward.
  const cssVar = (name) => {
    for (const el of [overlay, root, document.documentElement]) {
      const v = el && getComputedStyle(el).getPropertyValue(name).trim();
      if (v) return v;
    }
    return null;
  };
  const num = (name) => {
    const v = cssVar(name);
    return v === null ? null : parseFloat(v);
  };
  const cls = (name) => (root ? q(`[class*="${name}"]`, root) : null);
  const slipButton = root ? q('button[aria-expanded]', root) : null;
  const moonButton = root ? q('button[aria-label^="Full moon"]', root) : null;
  const figure = root ? q('figure', root) : null;
  const overlayDom = {
    slip: rect(cls('strip')),
    slipButton: rect(slipButton),
    card: rect(cls('card')),
    poem: rect(cls('column')),
    colophon: rect(cls('colophon')),
    translation: rect(cls('translation')),
    figure: rect(figure),
    moonButton: rect(moonButton),
  };
  const api = window.__festival ?? null;
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  return {
    hasApi: !!api,
    apiKeys: api ? Object.keys(api) : [],
    festivalAttr: document.documentElement.getAttribute('data-festival'),
    settled:
      document.documentElement.getAttribute('data-festival-settled') === 'true',
    hasRoot: !!root,
    rootInMain: !!root?.closest('main'),
    rootZ: rootStyle ? rootStyle.zIndex : null,
    canvas: canvas
      ? {
          rect: rect(canvas),
          dpr: canvas.width / Math.max(1, canvas.clientWidth),
          ariaHidden: canvas.getAttribute('aria-hidden'),
        }
      : null,
    canvasCount: qa('canvas').length,
    webglContexts: window.__gauntlet?.webgl ?? null,
    vars: {
      moonX: num('--moon-x'),
      moonY: num('--moon-y'),
      moonD: num('--moon-d'),
      poemTheta: num('--poem-theta'),
      slipTheta: num('--slip-theta'),
      night: num('--festival-night'),
      poolTint: cssVar('--festival-pool-tint'),
      haloTint: cssVar('--festival-halo-tint'),
    },
    accent: getComputedStyle(document.documentElement)
      .getPropertyValue('--accent')
      .trim(),
    background: getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim(),
    dom: overlayDom,
    slipOpen: slipButton?.getAttribute('aria-expanded') ?? null,
    layout: safe(() => api?.layout?.()) ?? null,
    theta: safe(() => api?.theta?.()) ?? null,
    frames: safe(() => api?.frames?.()) ?? null,
    time: safe(() => api?.time?.()) ?? null,
    rendererInfo: safe(() => JSON.parse(JSON.stringify(api?.rendererInfo?.()))),
    state: safe(() => {
      const s = api?.state?.();
      if (!s) return null;
      return {
        lanterns: (s.lanterns ?? []).map((l) => ({
          id: l.id,
          cordLength: l.cordLength,
          cordTarget: l.cordTarget,
          lit: l.lit,
          alpha: l.alpha,
          bob: l.bob,
          rise: l.rise,
          theta: l.theta,
          tasselTheta: l.tasselTheta,
          pool: l.pool,
        })),
        fallCount: (s.fall ?? []).filter((f) => f.alpha > 0).length,
        settled: s.settled,
      };
    }),
    timeline: window.__gauntlet?.t ?? {},
    timelineSim: window.__gauntlet?.sim ?? {},
    shown: window.__gauntlet?.shown ?? [],
    lcp: window.__gauntlet?.lcp?.at(-1) ?? null,
    heap: performance.memory?.usedJSHeapSize ?? null,
  };
}

/** Rects of the page's own hot zones (V8 obstacles), CSS px. */
function readObstacles() {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0
      ? { x: r.left, y: r.top, w: r.width, h: r.height }
      : null;
  };
  const out = [];
  const add = (label, sel) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      const r = rect(el);
      if (r) out.push({ label: `${label}${i ? '#' + i : ''}`, rect: r });
    });
  };
  add('nav', 'header.sticky');
  add('benchHeader', 'main > header');
  add('dockLink', 'main [class*="dockLink"]');
  add('h1', 'h1');
  add('benchDetails', 'main [class*="details"]');
  add('calendly', 'iframe');
  add('toolsPill', '.orb-hero-tools');
  add('themeDock', '.home-theme-dock');
  // Mobile fixed footer: any fixed element hugging the viewport bottom.
  for (const el of document.querySelectorAll('main *, footer')) {
    const s = getComputedStyle(el);
    if (s.position !== 'fixed') continue;
    const r = rect(el);
    if (r && r.y + r.h >= innerHeight - 2 && r.h < innerHeight / 2) {
      out.push({ label: 'fixedFooter', rect: r });
    }
  }
  return out;
}

/** Copy-column rects for V10 (mobile text-block diffs) and V2 edges. */
function readTextBlocks() {
  const out = [];
  for (const el of document.querySelectorAll(
    'main h1, main h2, main p, main li, main a',
  )) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue;
    out.push({
      x: Math.max(0, r.left),
      y: Math.max(0, r.top),
      w: Math.min(innerWidth, r.right) - Math.max(0, r.left),
      h: Math.min(innerHeight, r.bottom) - Math.max(0, r.top),
    });
  }
  return out.filter((r) => r.w > 0 && r.h > 0);
}

/**
 * Pixel statistics for a PNG (base64) over CSS-px rects, run in a scratch
 * page so no PNG decoder is needed on the node side. Returns per job:
 * maxY, meanY, maxRgb (colour of the brightest pixel), medianRgb of the
 * brightest decile, meanRgb, and optional row/column luminance profiles.
 */
async function analyzePng({ b64, dsf, jobs }) {
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const Y = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const results = {};
  for (const job of jobs) {
    const x = Math.max(0, Math.round(job.rect.x * dsf));
    const y = Math.max(0, Math.round(job.rect.y * dsf));
    const w = Math.min(bmp.width - x, Math.round(job.rect.w * dsf));
    const h = Math.min(bmp.height - y, Math.round(job.rect.h * dsf));
    if (w <= 0 || h <= 0) {
      results[job.id] = null;
      continue;
    }
    const d = ctx.getImageData(x, y, w, h).data;
    let maxY = 0;
    let sumY = 0;
    let maxRgb = [0, 0, 0];
    const sum = [0, 0, 0];
    const ys = [];
    const rows = job.rows ? new Float64Array(h) : null;
    const cols = job.cols ? new Float64Array(w) : null;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = (j * w + i) * 4;
        const r = d[k];
        const g = d[k + 1];
        const b = d[k + 2];
        const yy = Y(r, g, b);
        ys.push([yy, r, g, b]);
        sumY += yy;
        sum[0] += r;
        sum[1] += g;
        sum[2] += b;
        if (yy > maxY) {
          maxY = yy;
          maxRgb = [r, g, b];
        }
        if (rows) rows[j] += yy / w;
        if (cols) cols[i] += yy / h;
      }
    }
    ys.sort((a, b) => b[0] - a[0]);
    const decile = ys.slice(0, Math.max(1, Math.floor(ys.length / 10)));
    const mid = decile[Math.floor(decile.length / 2)];
    results[job.id] = {
      maxY,
      meanY: sumY / (w * h),
      maxRgb,
      brightDecileRgb: [mid[1], mid[2], mid[3]],
      meanRgb: sum.map((v) => Math.round(v / (w * h))),
      rows: rows ? Array.from(rows) : undefined,
      cols: cols ? Array.from(cols) : undefined,
    };
  }
  return results;
}

/** Counts differing pixels between two PNGs inside each CSS-px rect. */
async function diffPng({ a, b, dsf, rects }) {
  const load = async (b64) => {
    const bmp = await createImageBitmap(
      await (await fetch('data:image/png;base64,' + b64)).blob(),
    );
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    return { ctx, w: bmp.width, h: bmp.height };
  };
  const A = await load(a);
  const B = await load(b);
  const out = [];
  for (const rect of rects) {
    const x = Math.max(0, Math.round(rect.x * dsf));
    const y = Math.max(0, Math.round(rect.y * dsf));
    const w = Math.min(A.w - x, B.w - x, Math.round(rect.w * dsf));
    const h = Math.min(A.h - y, B.h - y, Math.round(rect.h * dsf));
    if (w <= 0 || h <= 0) {
      out.push({ rect, diff: 0, total: 0 });
      continue;
    }
    const da = A.ctx.getImageData(x, y, w, h).data;
    const db = B.ctx.getImageData(x, y, w, h).data;
    let diff = 0;
    for (let k = 0; k < da.length; k += 4) {
      if (
        Math.abs(da[k] - db[k]) > 2 ||
        Math.abs(da[k + 1] - db[k + 1]) > 2 ||
        Math.abs(da[k + 2] - db[k + 2]) > 2
      )
        diff++;
    }
    out.push({ rect, diff, total: w * h });
  }
  return out;
}

/** rAF loop in the page: samples θ arrays (and sim time) for `seconds`. */
function sampleTheta(seconds) {
  return new Promise((resolve) => {
    const g = window.__gauntlet;
    const api = window.__festival;
    const samples = [];
    const start = performance.now();
    const step = () => {
      const now = performance.now();
      let theta = null;
      let tassel = null;
      let sim = null;
      try {
        theta = api?.theta?.() ?? null;
        tassel = api?.tassel?.() ?? null;
        sim = api?.time?.() ?? null;
      } catch {}
      samples.push({
        wall: (now - (g.t0() ?? start)) / 1000,
        sim,
        theta: theta ? Array.from(theta) : null,
        tassel: tassel ? Array.from(tassel) : null,
        poem: (() => {
          const root =
            document.querySelector('[data-festival-root]') ??
            [...document.querySelectorAll('canvas')].find(
              (c) => !c.closest('main'),
            )?.parentElement ??
            null;
          const overlay = root
            ? ([...root.children].find((el) => el.tagName !== 'CANVAS') ?? root)
            : document.documentElement;
          return parseFloat(
            getComputedStyle(overlay).getPropertyValue('--poem-theta'),
          );
        })(),
      });
      if (now - start < seconds * 1000) requestAnimationFrame(step);
      else resolve(samples);
    };
    requestAnimationFrame(step);
  });
}

/** rAF gap statistics over `seconds` (idle or during a scripted sweep). */
function sampleFrameGaps(seconds) {
  return new Promise((resolve) => {
    const gaps = [];
    let last = performance.now();
    const start = last;
    const longBefore = window.__gauntlet?.longTasks ?? 0;
    const step = () => {
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      if (now - start < seconds * 1000) requestAnimationFrame(step);
      else {
        gaps.sort((a, b) => a - b);
        resolve({
          p95: gaps[Math.floor(gaps.length * 0.95)] ?? null,
          max: gaps.at(-1) ?? null,
          over33: gaps.filter((g) => g > 33).length,
          frames: gaps.length,
          longTasks: (window.__gauntlet?.longTasks ?? 0) - longBefore,
        });
      }
    };
    requestAnimationFrame(step);
  });
}

/**
 * Synthetic pointer sweep at a constant velocity, dispatched from the page so
 * the px/s is exact regardless of protocol latency. Moves along `y` from x0
 * to x1 over `ms`.
 */
function sweepPointer({ x0, x1, y, ms }) {
  return new Promise((resolve) => {
    const start = performance.now();
    const fire = (x) => {
      const target = document.elementFromPoint(x, y) ?? document.body;
      for (const type of ['pointermove', 'mousemove']) {
        target.dispatchEvent(
          new PointerEvent(type, {
            clientX: x,
            clientY: y,
            bubbles: true,
            composed: true,
            pointerType: 'mouse',
            isPrimary: true,
          }),
        );
      }
    };
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      fire(x0 + (x1 - x0) * t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    step();
  });
}

function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  window.dispatchEvent(new Event('theme-preference-change'));
}

/** Simulates a hidden tab: overrides the visibility getters and fires the event. */
function setHidden(hidden) {
  if (hidden) {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
  } else {
    delete document.visibilityState;
    delete document.hidden;
  }
  document.dispatchEvent(new Event('visibilitychange'));
}

// ---------------------------------------------------------------------------
// Signal analysis (node side)
// ---------------------------------------------------------------------------

const deg = (rad) => (rad * 180) / Math.PI;

/**
 * Dominant period (s) of a θ series by a DFT over 1.2–5 s. The series is
 * detrended first (a 3 s moving mean is subtracted) so a gust's slow lean
 * inside the window does not pull the peak (M4 samples across the second
 * gust at ≈ 16.5 s).
 */
function dominantPeriod(times, values) {
  if (times.length < 20) return null;
  values = detrend(times, values, 3);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let best = { period: null, power: -1 };
  for (let period = 1.2; period <= 5; period += 0.02) {
    const w = (2 * Math.PI) / period;
    let re = 0;
    let im = 0;
    for (let i = 0; i < times.length; i++) {
      const v = values[i] - mean;
      re += v * Math.cos(w * times[i]);
      im += v * Math.sin(w * times[i]);
    }
    const power = re * re + im * im;
    if (power > best.power) best = { period, power };
  }
  return best.period;
}

/** Count rib minima along a luminance row: minima ≥ 20% below both neighbours. */
/** Subtracts a centred moving mean of `windowS` seconds from `values`. */
function detrend(times, values, windowS) {
  const out = new Array(values.length);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    while (hi < values.length && times[hi] <= times[i] + windowS / 2) {
      sum += values[hi];
      hi++;
    }
    while (lo < hi && times[lo] < times[i] - windowS / 2) {
      sum -= values[lo];
      lo++;
    }
    out[i] = values[i] - sum / Math.max(1, hi - lo);
  }
  return out;
}

function countMinima(profile, drop = 0.2) {
  const p = profile.map((v, i, a) => {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(a.length - 1, i + 1);
    return (a[lo] + v + a[hi]) / 3;
  });
  let count = 0;
  for (let i = 2; i < p.length - 2; i++) {
    if (!(p[i] < p[i - 1] && p[i] <= p[i + 1])) continue;
    let l = i;
    while (l > 0 && p[l - 1] >= p[l]) l--;
    let r = i;
    while (r < p.length - 1 && p[r + 1] >= p[r]) r++;
    const peak = Math.min(p[l], p[r]);
    if (peak > 0 && p[i] <= peak * (1 - drop)) count++;
  }
  return count;
}

/**
 * Letter-width shadow columns (V6): rib dips are a few px wide, a cap advance
 * is ≥ 15 CSS px, so a running max with a 6 CSS-px radius removes the ribs;
 * then count runs ≥ 12 CSS px wide sitting ≥ 12% below the adjacent envelope.
 */
function countLetterColumns(cols, dsf) {
  const radius = Math.round(6 * dsf);
  const env = cols.map((_, i) =>
    Math.max(...cols.slice(Math.max(0, i - radius), i + radius + 1)),
  );
  const minRun = Math.round(12 * dsf);
  let count = 0;
  let run = 0;
  for (let i = 0; i < env.length; i++) {
    const left = Math.max(...env.slice(Math.max(0, i - 4 * radius), i + 1));
    const right = Math.max(...env.slice(i, i + 4 * radius + 1));
    const around = Math.max(left, right);
    if (around > 0 && env[i] <= around * 0.88) run++;
    else {
      if (run >= minRun) count++;
      run = 0;
    }
  }
  if (run >= minRun) count++;
  return count;
}

const intersects = (a, b, clearance = 0) =>
  a &&
  b &&
  a.x < b.x + b.w + clearance &&
  a.x + a.w + clearance > b.x &&
  a.y < b.y + b.h + clearance &&
  a.y + a.h + clearance > b.y;

const expandRect = (r, factor, aspect = 1) => {
  const w = r.w * factor;
  const h = r.w * factor * aspect;
  return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
};

const poolRect = (body) => {
  const w = body.w * POOL_WIDTH_FACTOR;
  const h = w * POOL_ASPECT;
  const cy = body.y + body.h / 2 + POOL_DROP_BODY_HEIGHTS * body.h;
  return { x: body.x + body.w / 2 - w / 2, y: cy - h / 2, w, h };
};

const moonRect = (moon) =>
  moon
    ? {
        x: moon.centre.x - moon.diameter / 2,
        y: moon.centre.y - moon.diameter / 2,
        w: moon.diameter,
        h: moon.diameter,
      }
    : null;

/** Estimates a translucent overlay's alpha from a sample colour over a known bg. */
function alphaEstimate(sample, bg, overlay) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const span = overlay[i] - bg[i];
    if (Math.abs(span) < 60) continue;
    parts.push((sample[i] - bg[i]) / span);
  }
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

// ---------------------------------------------------------------------------
// Browser session helpers
// ---------------------------------------------------------------------------

function festivalUrl(base, path, { flag = '1', debug = true } = {}) {
  const u = new URL(base + path);
  u.searchParams.set('festival', flag);
  u.searchParams.set('festival-seed', String(SEED));
  if (debug) u.searchParams.set('bench-debug', '1');
  return u.toString();
}

async function newContext(browser, vp, theme, colour = 'mono') {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  await ctx.addInitScript(
    ({ theme, colour }) => {
      localStorage.setItem('theme', theme);
      localStorage.setItem('color-theme', colour);
    },
    { theme, colour },
  );
  await ctx.addInitScript(initScript);
  return ctx;
}

/**
 * Waits until time since mount ≥ `ms` (sim time when the layer exposes it,
 * wall time otherwise) and returns the time reached. The wall timeout is
 * generous: under SwiftShader `/` runs at ≈ 3 fps and sim time at 0.1× wall.
 */
async function atMount(page, ms, timeout = 90000) {
  await page.waitForFunction(
    (ms) => {
      const n = window.__gauntlet?.now?.();
      return n !== undefined && n >= ms;
    },
    ms,
    { timeout, polling: 16 },
  );
  return page.evaluate(() => window.__gauntlet.now());
}

async function waitForLayer(page, timeout = 15000) {
  try {
    await page.waitForFunction(
      () => window.__gauntlet?.t?.canvas !== undefined,
      null,
      { timeout, polling: 50 },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Waits for `data-festival-settled`, giving up once the time since mount
 * (sim time when available) passes `limitMs`. Returns the settle time since
 * mount in that unit, or null.
 */
async function waitSettled(page, limitMs = 8000, timeout = 120000) {
  try {
    await page.waitForFunction(
      (limit) =>
        document.documentElement.getAttribute('data-festival-settled') ===
          'true' || (window.__gauntlet?.now?.() ?? 0) >= limit,
      limitMs,
      { timeout, polling: 16 },
    );
    return page.evaluate(() => {
      const g = window.__gauntlet;
      if (g.t.settled === undefined) return null;
      const st = g.sim.settled;
      return typeof st === 'number' ? st * 1000 : g.t.settled - g.t0();
    });
  } catch {
    return null;
  }
}

/** Screenshot → file + base64 for pixel analysis. */
async function shot(page, name, opts = {}) {
  const buf = await page.screenshot({ path: join(OUT, name), ...opts });
  return buf.toString('base64');
}

/** The layout the assertions measure against: live if the API has it, else computed. */
function expectedLayout(foundation, path, vp, live) {
  if (live?.layout) return { layout: live.layout, source: 'live' };
  if (!foundation.layout?.routeLayout) return { layout: null, source: 'none' };
  const layout = foundation.layout.routeLayout(
    path,
    { w: vp.width, h: vp.height },
    vp.mobile,
  );
  return { layout, source: 'computed' };
}

// ---------------------------------------------------------------------------
// Per-combination run: captures + assertions
// ---------------------------------------------------------------------------

async function runCombo({
  browser,
  lab,
  foundation,
  route,
  vpName,
  theme,
  colour,
}) {
  const vp = VIEWPORTS[vpName];
  const tag = `${route.key}-${vpName}-${theme}${colour !== 'mono' ? '-' + colour : ''}`;
  const id = (k) => `${k}@${tag}`;
  const ctx = await newContext(browser, vp, theme, colour);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const responses = [];
  page.on('response', (r) => responses.push(r));

  try {
    await page.goto(festivalUrl(BASE_URL, route.path), { waitUntil: 'load' });
    const present = await waitForLayer(page);
    if (!present) {
      await shot(page, `${tag}-missing.png`);
      const info = await page.evaluate(readOverlay);
      fail(
        id('layer'),
        'festival layer mounts',
        `no festival canvas within 15 s (data-festival=${info.festivalAttr}, canvases=${info.canvasCount})`,
        'canvas outside <main> + html[data-festival]',
        'every downstream check for this combo is skipped',
      );
      if (vp.mobile)
        await mobileFlagOffChecks({
          browser,
          lab,
          page,
          vp,
          theme,
          route,
          tag,
          onShot: null,
        });
      return;
    }

    // --- Mount states -----------------------------------------------------
    const stateShots = {};
    for (const ms of MOUNT_STATES_MS) {
      const at = await atMount(page, ms);
      stateShots[ms] = await shot(
        page,
        `${tag}-mount-${(ms / 1000).toFixed(1)}s.png`,
      );
      stateShots[`${ms}:at`] = at;
    }
    // Start the θ sampler now so it covers the first gust (4.4 s) window.
    const gustSampling = page.evaluate(sampleTheta, 6.5).catch(() => null);

    const settledMs = await waitSettled(page);
    const settledShot = await shot(page, `${tag}-settled.png`);
    const live = await page.evaluate(readOverlay);
    const { layout, source } = expectedLayout(foundation, route.path, vp, live);
    check(
      settledMs !== null && settledMs <= SETTLE_GATE_MS,
      id('M1.settled'),
      'data-festival-settled ≤ 4.5 s',
      settledMs === null ? 'never (8 s)' : `${fmt(settledMs, 0)} ms`,
      '≤ 4500 ms',
      live.time !== null
        ? 'sim time'
        : 'wall clock on SwiftShader; see GPU pass',
    );
    if (!live.hasApi) {
      fail(
        id('api'),
        'window.__festival under ?bench-debug=1',
        'absent',
        'wind/rendererInfo/theta/frames/layout',
      );
    }

    const gustAt = await atMount(page, GUST_STATE_MS);
    console.log(
      `  captures: ${MOUNT_STATES_MS.map((ms) => fmt(stateShots[`${ms}:at`], 0)).join('/')} ms, gust ${fmt(gustAt, 0)} ms after mount`,
    );
    const gustShot = await shot(page, `${tag}-gust-5.0s.png`);

    // --- Interaction states (desktop only: mobile has no text) -------------
    if (!vp.mobile) {
      await interactionStates({ page, tag, live });
    }

    // --- Static assertions -------------------------------------------------
    await guarded(id('timeline'), () =>
      timelineChecks({ live, id, vp, route, theme }),
    );
    await guarded(id('V8'), () =>
      rectChecks({ page, live, layout, source, id, vp, route }),
    );
    await guarded(id('pixels'), () =>
      pixelChecks({
        lab,
        live,
        layout,
        id,
        vp,
        route,
        theme,
        colour,
        shots: { ...stateShots, settled: settledShot, gust: gustShot },
        foundation,
      }),
    );
    if (!vp.mobile) {
      await guarded(id('T'), () =>
        typographyChecks({ page, live, id, route, theme, foundation }),
      );
      await guarded(id('A11y'), () =>
        a11yChecks({ page, live, id, route, theme }),
      );
    } else {
      await guarded(id('T6.mobile'), () => mobileTextChecks({ page, id }));
    }
    await guarded(id('perf'), () =>
      perfChecks({ page, live, id, vp, route, responses, layout }),
    );

    // --- Motion: first gust (M3) from the sampler started before 4.4 s ------
    const samples = await gustSampling;
    await guarded(id('M3'), () =>
      gustChecks({ samples, layout, id, vp, route, live }),
    );

    // --- Long samplings, desktop dark only ---------------------------------
    if (!vp.mobile && theme === 'dark' && colour === 'mono') {
      if (!QUICK) {
        await guarded(id('M4'), () =>
          periodChecks({ page, lab, layout, id, tag, live }),
        );
        await guarded(id('M5'), () =>
          sweepChecks({ page, layout, id, vp, live }),
        );
      }
      if (route.key === 'blog')
        await guarded(id('M8'), () => reducedMotionChecks({ page, ctx, id }));
      if (route.key === 'blog-slug')
        await guarded(id('M9'), () =>
          scrollChecks({ page, lab, layout, id, vp, tag }),
        );
    }
    // --- Theme toggle (M7): from the light run, dusk then morning ----------
    if (!vp.mobile && theme === 'light' && route.key !== 'home') {
      await guarded(id('M7'), () =>
        themeChecks({ page, lab, layout, id, vp, tag, live }),
      );
    }
    // --- Same-set resize re-anchors the moon (§7.3) -------------------------
    if (!vp.mobile && theme === 'dark' && colour === 'mono' && layout?.moon) {
      await guarded(id('resize'), () => resizeChecks({ page, id, vp }));
    }
    // --- Mobile: flag-off diffs (V10) --------------------------------------
    if (vp.mobile) {
      await mobileFlagOffChecks({
        browser,
        lab,
        page,
        vp,
        theme,
        route,
        tag,
        onShot: settledShot,
      });
    }
  } finally {
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Interaction states: slip hover, poem focus, moon hover (§7.7 state list)
// ---------------------------------------------------------------------------

async function interactionStates({ page, tag, live }) {
  const slip = page.locator('button[aria-expanded]').first();
  if (live.dom.slipButton) {
    await slip.hover();
    await page.waitForTimeout(900);
    await shot(page, `${tag}-slip-hover.png`);
    await page.keyboard.press('Escape');
    await page.mouse.move(5, 500);
  }
  if (live.dom.figure) {
    await page.locator('figure').first().focus();
    await page.waitForTimeout(400);
    await shot(page, `${tag}-poem-focus.png`);
    await page.locator('figure').first().blur();
  }
  if (live.dom.moonButton) {
    await page.locator('button[aria-label^="Full moon"]').first().hover();
    await page.waitForTimeout(400);
    await shot(page, `${tag}-moon-hover.png`);
    await page.mouse.move(5, 500);
  }
}

// ---------------------------------------------------------------------------
// Timeline: M1 stagger/rest (when state() is exposed), M2 translation window
// ---------------------------------------------------------------------------

function timelineChecks({ live, id, vp, route }) {
  const t = live.timeline;
  const ts = live.timelineSim ?? {};
  const t0 = Math.max(
    t.canvas ?? 0,
    Math.min(t.fontsReady ?? Infinity, (t.canvas ?? 0) + 800),
  );
  // Sim seconds from the mark when the layer exposed its clock (SwiftShader
  // runs the sim well below wall speed); wall ms since t0 otherwise.
  const rel = (k) => {
    if (typeof ts[k] === 'number') return ts[k] * 1000;
    return t[k] === undefined ? null : t[k] - t0;
  };
  const hasVerse = !vp.mobile && route.key !== 'home';

  if (hasVerse) {
    const caption = rel('shown:caption');
    check(
      caption !== null &&
        caption >= TRANSLATION_WINDOW_MS[0] &&
        caption <= TRANSLATION_WINDOW_MS[1] &&
        caption > LAST_POEM_GLYPH_MS,
      id('M2.translation'),
      'translation lands 2.4–3.6 s, after the last poem glyph, before the first gust',
      caption === null ? 'never' : `${fmt(caption, 0)} ms`,
      '2400–3600 ms',
      typeof ts['shown:caption'] === 'number'
        ? 'sim time, data-shown on the figcaption'
        : 'wall time, data-shown on the figcaption',
    );
    const poem = rel('shown:column') ?? rel('shown:figure');
    check(
      poem !== null && poem >= 1200 && poem <= 1700,
      id('M2.poem'),
      'poem reveal starts at 1.4 s',
      poem === null ? 'never' : `${fmt(poem, 0)} ms`,
      '1400 ms ± 200',
    );
  }
  if (live.state?.lanterns?.length) {
    const rest = live.state.lanterns.every(
      (l) => Math.abs(l.cordLength - l.cordTarget) < 1e-3,
    );
    check(
      rest,
      id('M1.rest'),
      'all cords at length when settled',
      rest
        ? 'yes'
        : JSON.stringify(
            live.state.lanterns.map((l) => [
              l.id,
              fmt(l.cordLength, 3),
              fmt(l.cordTarget, 3),
            ]),
          ),
      'cordLength == cordTarget',
    );
  } else {
    skip(
      id('M1.rest'),
      'hero at rest length by 1.2 s; stagger ≤ 240 ms',
      '__festival.state() not exposed; cord length is not observable from outside',
    );
  }
}

// ---------------------------------------------------------------------------
// V8: rect intersections (layout rects + live overlay DOM rects vs obstacles)
// ---------------------------------------------------------------------------

async function rectChecks({ page, live, layout, source, id, vp }) {
  if (!layout) {
    fail(
      id('V8'),
      'rect intersections',
      'no layout (live or computed)',
      '',
      '',
    );
    return;
  }
  const obstacles = await page.evaluate(readObstacles);
  const festivalRects = [];
  for (const l of layout.lanterns) {
    festivalRects.push({ label: `lantern ${l.id} body`, rect: l.bodyRect });
    if (l.slipRect)
      festivalRects.push({ label: `slip ${l.id}`, rect: l.slipRect });
    if (l.cardRect)
      festivalRects.push({ label: `card ${l.id} (layout)`, rect: l.cardRect });
  }
  for (const k of ['poem', 'colophon', 'translation']) {
    if (layout.text?.[k])
      festivalRects.push({ label: `${k} (layout)`, rect: layout.text[k] });
  }
  for (const k of ['slip', 'card', 'poem', 'colophon', 'translation']) {
    if (live.dom[k])
      festivalRects.push({ label: `${k} (dom)`, rect: live.dom[k] });
  }
  const hits = [];
  for (const f of festivalRects) {
    for (const o of obstacles) {
      // The nav band counts with its 24 px clearance for lantern bodies.
      const clearance =
        o.label.startsWith('nav') && f.label.includes('body') ? 24 : 0;
      if (intersects(f.rect, o.rect, clearance))
        hits.push(`${f.label} × ${o.label}`);
    }
  }
  check(
    hits.length === 0,
    id('V8.rects'),
    'festival rects intersect no page hot zone',
    hits.length
      ? hits.join('; ')
      : `${festivalRects.length} rects vs ${obstacles.length} zones clear`,
    'no intersections',
    `layout: ${source}`,
  );

  const moon = moonRect(layout.moon);
  if (moon) {
    const bad = layout.lanterns.filter((l) => {
      const cordTop = Math.min(l.cordAnchorY ?? 0, l.bodyRect.y);
      const cord = { x: l.x - 1, y: cordTop, w: 2, h: l.bodyRect.y - cordTop };
      const dx = Math.abs(l.x - layout.moon.centre.x);
      return intersects(cord, moon, 30) && dx < layout.moon.diameter / 2 + 30;
    });
    check(
      bad.length === 0,
      id('V8.cords'),
      'cords ≥ 30 px clear of the moon disc',
      bad.length ? bad.map((l) => l.id).join(',') : 'clear',
      'no cord within 30 px',
    );
  }
  if (!vp.mobile) {
    const bodyOk = layout.lanterns.every(
      (l) => l.bodyRect.y >= (layout.navBottom ?? 0) + 24 - 0.5,
    );
    check(
      bodyOk,
      id('V8.nav'),
      'lantern bodies ≥ 24 px below the nav band',
      layout.lanterns
        .map((l) => `${l.id}:${fmt(l.bodyRect.y - (layout.navBottom ?? 0), 0)}`)
        .join(' '),
      '≥ 24 px',
    );
  }
  const budget = vp.mobile ? 1 : 3;
  check(
    layout.lanterns.length <= budget,
    id('budget.lanterns'),
    'lantern count within budget',
    layout.lanterns.length,
    `≤ ${budget}`,
  );
  check(
    layout.florets.count <= (vp.mobile ? 12 : 36),
    id('budget.florets'),
    'floret count within budget',
    layout.florets.count,
    vp.mobile ? '≤ 12' : '≤ 36',
  );
}

// ---------------------------------------------------------------------------
// Pixel assertions: V1, V2, V3, V4, V5, V6, V7, V9, M1 candle catch
// ---------------------------------------------------------------------------

async function pixelChecks({
  lab,
  live,
  layout,
  id,
  vp,
  route,
  theme,
  colour,
  shots,
  foundation,
}) {
  if (!layout || vp.mobile) {
    if (vp.mobile)
      skip(
        id('pixels'),
        'V1–V7 pixel checks',
        'mobile has no lantern text/moon lockup; V10 covers the phone',
      );
    else
      fail(
        id('pixels'),
        'V1–V7 pixel checks',
        'no layout to locate rects',
        '',
        '',
      );
    return;
  }
  const P = foundation.palette?.palette;
  const hero = layout.lanterns.find((l) => l.hero) ?? layout.lanterns[0];
  if (!hero) {
    skip(id('pixels'), 'V1–V7 pixel checks', 'route has no lanterns');
    return;
  }
  const bg = hexRgb(
    live.background || (theme === 'dark' ? '#12100d' : '#f5f1e9'),
  );
  const isHome = route.key === 'home';
  const setBg = isHome ? hexRgb('#c8c8c8') : bg;
  const analyze = (b64, jobs) =>
    lab.evaluate(analyzePng, { b64, dsf: vp.dsf, jobs });

  // Regions of the settled capture.
  const heroCore = {
    x: hero.bodyRect.x + hero.bodyRect.w * 0.3,
    y: hero.bodyRect.y + hero.bodyRect.h * 0.3,
    w: hero.bodyRect.w * 0.4,
    h: hero.bodyRect.h * 0.4,
  };
  const equator = {
    x: hero.bodyRect.x + 2,
    y: hero.bodyRect.y + hero.bodyRect.h * 0.47,
    w: hero.bodyRect.w - 4,
    h: Math.max(3, hero.bodyRect.h * 0.06),
  };
  const jobs = [
    { id: 'heroBody', rect: hero.bodyRect },
    { id: 'heroCore', rect: heroCore },
    { id: 'equator', rect: equator, cols: true },
  ];
  const haloRing = expandRect(hero.bodyRect, HALO_WIDTH_FACTOR);
  jobs.push({ id: 'haloRing', rect: haloRing });
  for (const l of layout.lanterns) {
    jobs.push({
      id: `lantern:${l.id}`,
      rect: expandRect(l.bodyRect, HALO_WIDTH_FACTOR),
    });
  }
  const moon = moonRect(layout.moon);
  if (moon) jobs.push({ id: 'moon', rect: moon });
  const pool = poolRect(hero.bodyRect);
  const poolCentre = {
    x: pool.x + pool.w / 2 - 6,
    y: pool.y + pool.h / 2 - 6,
    w: 12,
    h: 12,
  };
  jobs.push({ id: 'poolCentre', rect: poolCentre });
  // Copy-column edge nearest the hero, from the layout's exclusion rects.
  const column = columnEdge(layout, hero, vp);
  if (column)
    jobs.push({
      id: 'columnEdge',
      rect: { x: column.x, y: pool.y, w: 4, h: pool.h },
    });

  const s = await analyze(shots.settled, jobs);
  const early = await analyze(shots[500], [{ id: 'heroCore', rect: heroCore }]);

  const litIndex = (r) => (r ? r.meanRgb[0] - r.meanRgb[2] : null); // warm − cool
  const lit = theme === 'dark' || isHome;

  // M1 candle catch visible: unlit-ish at 0.5 s, lit when settled.
  if (lit) {
    const li0 = litIndex(early.heroCore);
    const li1 = litIndex(s.heroCore);
    check(
      li1 !== null && li1 > 100 && (li0 === null || li0 < li1),
      id('M1.catch'),
      'candle catch visible (0.5 s → settled)',
      `warmth 0.5 s ${fmt(li0, 0)} → settled ${fmt(li1, 0)}`,
      'settled > 100 and > 0.5 s value',
      'warmth = mean(R − B) in the hero core',
    );
  }

  // V1 paper reads as paper: ribs, no pixel brighter than paperCore.
  if (lit && P) {
    const coreY = luminance(hexRgb(P.paperCore));
    check(
      s.heroBody.maxY <= coreY + 0.03,
      id('V1.noPlastic'),
      'no pixel in the drum brighter than paperCore',
      `maxY ${fmt(s.heroBody.maxY, 3)} rgb(${s.heroBody.maxRgb})`,
      `≤ ${fmt(coreY, 3)} (+0.03)`,
    );
    const minima = countMinima(s.equator.cols, 0.2);
    check(
      minima >= 12,
      id('V1.ribs'),
      '≥ 12 rib minima along the equator (each ≥ 20% below neighbours)',
      minima,
      '≥ 12',
      `2× crop ${equator.w * vp.dsf} px wide`,
    );
  }

  // V2 pool visible beside the H1 and < 0.02 at the column edge.
  if (lit && P) {
    const poolTint = hexRgb(P.paperMid);
    const centreAlpha = alphaEstimate(s.poolCentre.meanRgb, setBg, poolTint);
    const edgeAlpha =
      column && s.columnEdge
        ? alphaEstimate(s.columnEdge.meanRgb, setBg, poolTint)
        : null;
    check(
      centreAlpha !== null && centreAlpha >= 0.04,
      id('V2.poolVisible'),
      'pool visible on the page',
      `α≈${fmt(centreAlpha, 3)} at (${fmt(poolCentre.x, 0)},${fmt(poolCentre.y, 0)})`,
      '≥ 0.04 (peak 0.14 / 0.10 on /)',
    );
    if (edgeAlpha !== null)
      check(
        edgeAlpha < 0.02 + 0.01,
        id('V2.poolEdge'),
        'pool alpha < 0.02 at the copy-column edge',
        `α≈${fmt(edgeAlpha, 3)} at x${fmt(column.x, 0)}`,
        '< 0.02 (+0.01 noise)',
      );
    else
      skip(
        id('V2.poolEdge'),
        'pool alpha at the column edge',
        'no copy-column edge on this route',
      );
  }

  // V3 luminance order: moon > every lantern rect (paper or halo), dark only.
  if (theme === 'dark' && moon) {
    const lanternMax = Math.max(
      ...layout.lanterns.map((l) => s[`lantern:${l.id}`]?.maxY ?? 0),
    );
    check(
      s.moon.maxY > lanternMax,
      id('V3.luminance'),
      'max luminance in the moon rect > any lantern/halo rect',
      `moon ${fmt(s.moon.maxY, 3)} vs lanterns ${fmt(lanternMax, 3)}`,
      'moon > lanterns',
    );
  }

  // V4 light theme: cream paper, no glow, moon ≤ 8%.
  if (theme === 'light' && !isHome && P) {
    const cream = hexRgb(P.paperUnlit);
    const got = s.heroBody.brightDecileRgb;
    const delta = Math.max(...got.map((v, i) => Math.abs(v - cream[i])));
    check(
      delta <= 6,
      id('V4.cream'),
      'unlit paper #e9dcc4 ± 6 (brightest decile)',
      `rgb(${got}) Δ${delta}`,
      `rgb(${cream}) ± 6`,
    );
    const ringGlow = s.haloRing.maxY - luminance(bg);
    check(
      s.haloRing.maxY <= Math.max(luminance(bg), luminance(cream)) + 0.02,
      id('V4.noGlow'),
      'no glow around the lantern in light',
      `ring maxY ${fmt(s.haloRing.maxY, 3)} (bg ${fmt(luminance(bg), 3)})`,
      '≤ max(bg, cream) + 0.02',
      `Δ ${fmt(ringGlow, 3)}`,
    );
    if (moon) {
      const moonAlpha =
        (s.moon.maxY - luminance(bg)) /
        Math.max(1e-6, luminance(hexRgb(P.moonBody)) - luminance(bg));
      check(
        moonAlpha <= 0.1,
        id('V4.moon'),
        'daytime moon ≤ 8% alpha',
        `α≈${fmt(moonAlpha, 3)}`,
        '≤ 0.08 (+0.02)',
      );
    }
  }

  // V5 `/`: no additive halo; warm pool; nothing below y330 or in the H1 block.
  if (isHome) {
    const grey = luminance(setBg);
    check(
      s.haloRing.maxY <= grey + 0.03,
      id('V5.noHalo'),
      'no additive halo on the grey set',
      `ring maxY ${fmt(s.haloRing.maxY, 3)} vs set ${fmt(grey, 3)}`,
      '≤ set + 0.03',
    );
    const emittersOk = layout.florets.emitters.every(
      (e) => e.y + e.h <= 330 + 0.5,
    );
    const bodiesOk = layout.lanterns.every(
      (l) => l.bodyRect.y + l.bodyRect.h <= 330,
    );
    check(
      emittersOk && bodiesOk,
      id('V5.below330'),
      'nothing festival below y330',
      `emitters ${layout.florets.emitters.map((e) => fmt(e.y + e.h, 0)).join(',')}`,
      '≤ 330',
    );
    const h1Block = { x: 40, y: 88, w: 416, h: 282 };
    const dockBlock = { x: 1303, y: 0, w: 97, h: 64 };
    const all = [
      ...layout.lanterns.map((l) => l.bodyRect),
      ...layout.florets.emitters,
      ...(layout.text?.colophon ? [layout.text.colophon] : []),
    ];
    const hits = all.filter(
      (r) => intersects(r, h1Block) || intersects(r, dockBlock),
    ).length;
    check(
      hits === 0,
      id('V5.zones'),
      'nothing festival inside x40–456 y88–370 or above y64 at x1303–1400',
      `${hits} rects`,
      '0',
    );
    skip(
      id('V5.floretAlpha'),
      'florets ≤ 0.6 alpha on /',
      'alpha of moving sprites is not recoverable from a composite; layout caps alphaMax=' +
        fmt(layout.florets.alphaMax, 2),
    );
  }

  // V6 走马灯 legibility: best of several crops (a title may be between loops).
  if (lit && hero.body >= 72) {
    const crops = [shots.settled, shots.gust];
    let best = 0;
    for (const b64 of crops) {
      const r = await analyze(b64, [{ id: 'eq', rect: equator, cols: true }]);
      best = Math.max(best, countLetterColumns(r.eq.cols, vp.dsf));
    }
    // Later crops (from the M4 window) are added by periodChecks via v6Extra.
    v6State.set(id('V6'), { best, hero: hero.body, equator, tag: id('V6') });
  }

  // V7 colour themes on /blog: lamp stays warm; pool tint follows the hue gate.
  if (
    route.key === 'blog' &&
    theme === 'dark' &&
    P &&
    foundation.palette?.accentTints
  ) {
    const core = hexRgb(P.paperCore);
    const got = s.heroBody.maxRgb;
    const delta = Math.max(...got.map((v, i) => Math.abs(v - core[i])));
    check(
      delta <= 4,
      id('V7.lamp'),
      `lamp stays warm under ${colour}`,
      `brightest rgb(${got}) Δ${delta}`,
      `#ffd58a ± 4`,
    );
    const tints = foundation.palette.accentTints(live.accent);
    check(
      live.vars.poolTint?.toLowerCase() === tints.pool.toLowerCase(),
      id('V7.poolTint'),
      `pool tint ${tints.passed ? 'accent-mixed' : 'pure paperMid'} under ${colour}`,
      `--festival-pool-tint ${live.vars.poolTint} (accent ${live.accent})`,
      tints.pool,
    );
    check(
      live.vars.haloTint?.toLowerCase() === tints.halo.toLowerCase(),
      id('V7.haloTint'),
      `halo tint under ${colour}`,
      `${live.vars.haloTint}`,
      tints.halo,
    );
  }
}

/** Copy-column edge nearest the hero, from the layout's text exclusions. */
function columnEdge(layout, hero, vp) {
  const rects = layout.textExclusions?.length
    ? layout.textExclusions
    : layout.exclusions;
  const candidates = rects
    .filter((r) => r.w > 200 && r.h > 100)
    .map((r) => (hero.x < vp.width / 2 ? { x: r.x } : { x: r.x + r.w }));
  if (!candidates.length) return null;
  return hero.x < vp.width / 2
    ? candidates.reduce((a, b) => (a.x < b.x ? a : b))
    : candidates.reduce((a, b) => (a.x > b.x ? a : b));
}

const v6State = new Map();

// ---------------------------------------------------------------------------
// M3 first gust: arrival per lantern, peak order and spacing
// ---------------------------------------------------------------------------

function gustChecks({ samples, layout, id, vp, route }) {
  if (!samples || !samples.some((s) => s.theta)) {
    skip(
      id('M3'),
      'first-gust arrival timings',
      '__festival.theta() unavailable during 2.6–9 s',
    );
    return;
  }
  if (!layout?.lanterns?.length) return;
  const useSim = samples.every((s) => typeof s.sim === 'number');
  const time = (s) => (useSim ? s.sim : s.wall);
  const n = layout.lanterns.length;
  const arrivals = [];
  const peaks = [];
  for (let i = 0; i < n; i++) {
    const series = samples
      .filter((s) => s.theta && s.theta.length > i)
      .map((s) => ({ t: time(s), v: s.theta[i] }));
    const pre = series.filter(
      (p) => p.t < FIRST_GUST_S && p.t > FIRST_GUST_S - 1,
    );
    const preMax = Math.max(0.0001, ...pre.map((p) => Math.abs(p.v)));
    const after = series.filter((p) => p.t >= FIRST_GUST_S - 0.05);
    const peak = after.reduce(
      (a, b) => (Math.abs(b.v) > Math.abs(a.v) ? b : a),
      { t: null, v: 0 },
    );
    const delta = Math.abs(peak.v) - preMax;
    const arrival =
      after.find((p) => Math.abs(p.v) - preMax >= 0.25 * delta)?.t ?? null;
    arrivals.push(arrival);
    peaks.push(peak);
  }
  const ordered = [...layout.lanterns.keys()].sort(
    (a, b) => layout.lanterns[a].x - layout.lanterns[b].x,
  );
  const expectedArrival = (x) =>
    FIRST_GUST_S + (x + 0.1 * vp.width) / (GUST_SPEED_VW * vp.width);
  const rows = ordered.map((i) => {
    const l = layout.lanterns[i];
    return `${l.id}@x${l.x}: arrive ${fmt(arrivals[i], 2)} (exp ${fmt(expectedArrival(l.x), 2)}) peak ${fmt(deg(peaks[i].v), 1)}° at ${fmt(peaks[i].t, 2)}`;
  });
  const arrivalOk = ordered.every(
    (i) =>
      arrivals[i] !== null &&
      Math.abs(arrivals[i] - expectedArrival(layout.lanterns[i].x)) <=
        GUST_TOLERANCE_MS / 1000,
  );
  check(
    arrivalOk,
    id('M3.arrival'),
    'first gust reaches each lantern at 4.4 + (x + 0.1vw)/(0.55vw/s) ± 120 ms',
    rows.join(' | '),
    '± 0.12 s',
    useSim ? 'sim time' : 'wall time (time() not exposed)',
  );
  // Onsets: the first frame after the front leaves (4.4 s) where θ moves
  // more than 0.15° from its pre-gust value. Peaks cannot carry the spacing
  // (a lighter lantern with a shorter period answers ≈ 200 ms faster).
  const onsets = [];
  for (let i = 0; i < n; i++) {
    const series = samples
      .filter((s) => s.theta && s.theta.length > i)
      .map((s) => ({ t: time(s), v: s.theta[i] }));
    const pre = series.filter((p) => p.t <= FIRST_GUST_S && p.t > 0).at(-1);
    const onset =
      pre &&
      series.find(
        (p) => p.t > FIRST_GUST_S && Math.abs(deg(p.v - pre.v)) > 0.15,
      );
    onsets.push(onset ? onset.t : null);
  }
  const inOrder = ordered.every(
    (i, k) =>
      k === 0 ||
      (onsets[i] !== null &&
        onsets[ordered[k - 1]] !== null &&
        onsets[i] >= onsets[ordered[k - 1]]),
  );
  let spacingOk = true;
  const spacing = [];
  for (let k = 1; k < ordered.length; k++) {
    const dx =
      layout.lanterns[ordered[k]].x - layout.lanterns[ordered[k - 1]].x;
    const exp = dx / (GUST_SPEED_VW * vp.width);
    const got =
      onsets[ordered[k]] === null || onsets[ordered[k - 1]] === null
        ? null
        : onsets[ordered[k]] - onsets[ordered[k - 1]];
    spacing.push(`${fmt(got, 2)} (exp ${fmt(exp, 2)})`);
    if (got === null || Math.abs(got - exp) > GUST_ONSET_TOLERANCE_MS / 1000)
      spacingOk = false;
  }
  if (n > 1)
    check(
      inOrder && spacingOk,
      id('M3.order'),
      'θ onsets in x order with spacing Δx/(0.55 vw/s) ± 150 ms',
      spacing.join(' | '),
      '± 0.15 s',
    );
  const peakDeg = ordered.map((i) => Math.abs(deg(peaks[i].v)));
  check(
    peakDeg.every((d) => d >= 4 && d <= 10),
    id('M3.peak'),
    'first gust peaks 5–8° (tolerance 4–10)',
    peakDeg.map((d) => fmt(d, 1)).join('/'),
    '5–8°',
    route.key,
  );
}

// ---------------------------------------------------------------------------
// M4 periods over 20 s (also feeds V6 with extra drum crops)
// ---------------------------------------------------------------------------

async function periodChecks({ page, lab, layout, id, tag, live }) {
  if (!live.hasApi) {
    skip(id('M4'), 'pendulum periods (20 s θ sampling)', '__festival absent');
    return;
  }
  const v6 = v6State.get(id('V6'));
  const sampling = page.evaluate(sampleTheta, 20);
  const crops = [];
  for (let k = 0; k < 4; k++) {
    await page.waitForTimeout(5000);
    if (v6)
      crops.push(
        await page.screenshot({
          clip: {
            x: v6.equator.x - 2,
            y: layout.lanterns.find((l) => l.hero).bodyRect.y,
            width: v6.equator.w + 4,
            height: layout.lanterns.find((l) => l.hero).bodyRect.h,
          },
          path: join(OUT, `${tag}-drum-${k}.png`),
        }),
      );
  }
  const samples = await sampling;
  const useSim = samples.every((s) => typeof s.sim === 'number');
  const time = (s) => (useSim ? s.sim : s.wall);
  const periods = layout.lanterns.map((l, i) => {
    const pts = samples.filter((s) => s.theta && s.theta.length > i);
    return {
      id: l.id,
      expected: l.period,
      got: dominantPeriod(
        pts.map(time),
        pts.map((s) => s.theta[i]),
      ),
    };
  });
  const within = periods.every(
    (p) =>
      p.got !== null &&
      Math.abs(p.got - p.expected) / p.expected <= PERIOD_TOLERANCE,
  );
  check(
    within,
    id('M4.periods'),
    'θ spectrum peaks at each lantern period ± 8%',
    periods
      .map((p) => `${p.id} ${fmt(p.got, 2)}s (exp ${p.expected})`)
      .join(' | '),
    '± 8%',
    useSim ? 'sim time' : 'wall time',
  );
  const gots = periods.map((p) => p.got).filter((v) => v !== null);
  let distinct = true;
  for (let a = 0; a < gots.length; a++)
    for (let b = a + 1; b < gots.length; b++)
      if (
        Math.abs(gots[a] - gots[b]) / Math.max(gots[a], gots[b]) <
        PERIOD_TOLERANCE
      )
        distinct = false;
  if (gots.length > 1)
    check(
      distinct,
      id('M4.distinct'),
      'no two periods within 8%',
      gots.map((g) => fmt(g, 2)).join('/'),
      'pairwise > 8%',
    );

  if (v6) {
    let best = v6.best;
    for (const buf of crops) {
      const r = await lab.evaluate(analyzePng, {
        b64: buf.toString('base64'),
        dsf: 2,
        jobs: [
          {
            id: 'eq',
            rect: {
              x: 2,
              y: layout.lanterns.find((l) => l.hero).bodyRect.h * 0.47,
              w: v6.equator.w,
              h: Math.max(
                3,
                layout.lanterns.find((l) => l.hero).bodyRect.h * 0.06,
              ),
            },
            cols: true,
          },
        ],
      });
      best = Math.max(best, countLetterColumns(r.eq.cols, 2));
    }
    v6State.set(id('V6'), { ...v6, best });
  }
}

// ---------------------------------------------------------------------------
// M5 pointer sweep at 1200 px/s
// ---------------------------------------------------------------------------

async function sweepChecks({ page, layout, id, vp, live }) {
  if (!live.hasApi || !layout?.lanterns?.length) {
    skip(
      id('M5'),
      'pointer sweep deflection',
      '__festival absent or no lanterns',
    );
    return;
  }
  const hero = layout.lanterns.find((l) => l.hero) ?? layout.lanterns[0];
  const y = hero.bodyRect.y + hero.bodyRect.h / 2;
  const span = Math.min(600, vp.width - 40);
  const x0 = Math.max(20, Math.min(vp.width - span - 20, hero.x - span / 2));
  const x1 = x0 + span;
  const sampling = page.evaluate(sampleTheta, 3);
  await page.evaluate(sweepPointer, {
    x0,
    x1,
    y,
    ms: (span / SWEEP_PX_PER_S) * 1000,
  });
  const samples = await sampling;
  const maxDeg = layout.lanterns.map((l, i) =>
    Math.max(
      ...samples
        .filter((s) => s.theta?.length > i)
        .map((s) => Math.abs(deg(s.theta[i]))),
    ),
  );
  const dist = layout.lanterns.map((l) => Math.abs(l.x - hero.x));
  const nearest = dist.indexOf(Math.min(...dist));
  const farthest = dist.indexOf(Math.max(...dist));
  check(
    maxDeg[nearest] >= 8,
    id('M5.nearest'),
    'sweep at 1200 px/s deflects the nearest lantern ≥ 8°',
    `${layout.lanterns[nearest].id} ${fmt(maxDeg[nearest], 1)}°`,
    '≥ 8°',
  );
  if (farthest !== nearest && dist[farthest] > 0.35 * vp.width)
    check(
      maxDeg[farthest] <= 3,
      id('M5.farthest'),
      'farthest lantern ≤ 3°',
      `${layout.lanterns[farthest].id} ${fmt(maxDeg[farthest], 1)}° at ${fmt(dist[farthest], 0)} px`,
      '≤ 3°',
    );
  const poemMax = Math.max(0, ...samples.map((s) => Math.abs(s.poem || 0)));
  if (layout.text?.poem)
    check(
      poemMax <= 0.6 + 0.01,
      id('M5.poem'),
      'poem column leans ≤ 0.6°',
      `${fmt(poemMax, 2)}°`,
      '≤ 0.6°',
    );
  const withTassel = samples.filter((s) => s.theta && s.tassel);
  if (withTassel.length > 20) {
    const t = (s) => (typeof s.sim === 'number' ? s.sim : s.wall);
    const peakOf = (col, from) => {
      for (let k = 1; k < withTassel.length - 1; k++) {
        const v = Math.abs(withTassel[k][col][nearest]);
        if (
          t(withTassel[k]) >= from &&
          v > Math.abs(withTassel[k - 1][col][nearest]) &&
          v >= Math.abs(withTassel[k + 1][col][nearest])
        )
          return { t: t(withTassel[k]), v };
      }
      return null;
    };
    const body = peakOf('theta', 0);
    const tassel = body && peakOf('tassel', body.t - 0.05);
    const lag = body && tassel ? (tassel.t - body.t) * 1000 : null;
    check(
      lag !== null && lag >= 80 && lag <= 150,
      id('M5.tassel'),
      'tassel peak lags body peak 80–150 ms (relative angle, nearest lantern)',
      lag === null
        ? 'no peak pair'
        : `${fmt(lag, 0)} ms, relative amplitude ${fmt((100 * tassel.v) / body.v, 0)}%`,
      '80–150 ms',
      'frame-quantised on SwiftShader',
    );
  } else
    skip(
      id('M5.tassel'),
      'tassel lags body 80–150 ms',
      '__festival.tassel() not exposed',
    );
  skip(
    id('M5.noAttraction'),
    'no attraction from a still pointer',
    'needs a human eye pass; force ∝ velocity is a code-review item',
  );
  await page.waitForTimeout(2500);
}

// ---------------------------------------------------------------------------
// §7.3 resize: the moon re-anchors from px on a same-set resize
// ---------------------------------------------------------------------------

async function resizeChecks({ page, id, vp }) {
  const read = () =>
    page.evaluate(() => {
      const api = window.__festival;
      const layout = api?.layout?.();
      const moon = api?.moon?.();
      return {
        anchor: layout?.moon?.centre ?? null,
        centre: moon ? { x: moon.centre.x, y: moon.centre.y } : null,
        ids: layout?.lanterns?.map((l) => l.id).join('') ?? '',
      };
    });
  const before = await read();
  await page.setViewportSize({ width: vp.width + 160, height: vp.height });
  const t0 = await page.evaluate(() => window.__gauntlet.now());
  await atMount(page, t0 + 1200);
  const after = await read();
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await atMount(page, t0 + 2400);
  if (!before.anchor || !after.anchor || after.ids !== before.ids) {
    skip(
      id('resize.moon'),
      'same-set resize re-anchors the moon',
      `lantern set changed (${before.ids} → ${after.ids}); the route path glides it`,
    );
    return;
  }
  const dx = after.centre ? after.centre.x - after.anchor.x : NaN;
  const dy = after.centre ? after.centre.y - after.anchor.y : NaN;
  check(
    Math.abs(dx) <= 1 &&
      Math.abs(dy) <= 1 &&
      after.anchor.x !== before.anchor.x,
    id('resize.moon'),
    'same-set resize: moon().centre equals layout().moon.centre within 1 px',
    `anchor ${fmt(before.anchor.x, 0)} → ${fmt(after.anchor.x, 0)}, moon at ${fmt(after.centre?.x, 0)} (Δ ${fmt(dx, 1)}, ${fmt(dy, 1)})`,
    '|Δ| ≤ 1 px',
  );
}

// ---------------------------------------------------------------------------
// M6 route change /blog → /past-experience (desktop dark + light, mobile dark)
// ---------------------------------------------------------------------------

async function routeChangeRun({ browser, lab, foundation, vpName, theme }) {
  const vp = VIEWPORTS[vpName];
  const tag = `route-blog-to-past-${vpName}-${theme}`;
  const id = (k) => `${k}@${tag}`;
  const ctx = await newContext(browser, vp, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  try {
    await page.goto(festivalUrl(BASE_URL, '/blog'), { waitUntil: 'load' });
    if (!(await waitForLayer(page))) {
      fail(id('M6'), 'route change', 'layer missing on /blog', '', '');
      return;
    }
    await waitSettled(page);
    const before = await page.evaluate(readOverlay);
    const windIdBefore = await page
      .evaluate(() => globalThis.__festivalWind ?? null)
      .then((w) => !!w);
    // Navigate at 5.4 s: the first gust (4.4 s) started 1 s earlier.
    await atMount(page, 5400, 12000);
    const windBefore = await page.evaluate(() => {
      try {
        return window.__festival?.wind?.() ?? null;
      } catch {
        return null;
      }
    });
    const link = page.locator('a[href="/past-experience"]').first();
    if ((await link.count()) === 0) {
      fail(
        id('M6'),
        'route change',
        'no <a href="/past-experience"> on /blog',
        '',
        '',
      );
      return;
    }
    const tClick = await page.evaluate(() => performance.now());
    await link.click({ noWaitAfter: true });
    const sinceClick = (ms) =>
      page.waitForFunction(
        (args) => performance.now() - args.t >= args.ms,
        { t: tClick, ms },
        { polling: 8 },
      );
    // Mid-exit capture (§7.7: 140 ms after the navigation).
    await sinceClick(140);
    await page.screenshot({ path: join(OUT, `${tag}-mid-exit.png`) });
    // Moon glide: three samples inside the 600 ms glide.
    const moonSamples = [];
    for (const ms of [250, 400, 550]) {
      await sinceClick(ms);
      moonSamples.push(
        await page
          .evaluate(readOverlay)
          .then((o) => ({ x: o.vars.moonX, y: o.vars.moonY })),
      );
    }
    const exitStart = await page.evaluate(
      () => window.__gauntlet.t['text:exit'],
    );
    check(
      exitStart !== undefined && exitStart - tClick <= 200,
      id('M6.textExit'),
      'text exit starts ≤ 200 ms after navigation',
      exitStart === undefined
        ? 'data-text="exit" never set'
        : `${fmt(exitStart - tClick, 0)} ms`,
      '≤ 200 ms',
    );
    const xs = moonSamples.map((m) => m.x).filter((v) => v !== null);
    const monotonic =
      xs.length === 3 &&
      ((xs[0] <= xs[1] && xs[1] <= xs[2]) ||
        (xs[0] >= xs[1] && xs[1] >= xs[2])) &&
      xs[0] !== xs[2];
    if (!vp.mobile)
      check(
        monotonic,
        id('M6.moonGlide'),
        'moon glides (3 samples monotonic)',
        xs.map((v) => fmt(v, 0)).join(' → '),
        'monotonic, moving',
        'from --moon-x',
      );
    await page
      .waitForFunction(() => location.pathname === '/past-experience', null, {
        timeout: 8000,
      })
      .catch(() => {});
    // Exit 280 ms + enter ≈ 1.0 s to lit (§4.2): judge the new lockup at +1.4 s.
    await sinceClick(1400);
    const after = await page.evaluate(readOverlay);
    const { layout } = expectedLayout(
      foundation,
      '/past-experience',
      vp,
      after,
    );
    if (!vp.mobile && layout) {
      const hero = layout.lanterns.find((l) => l.hero);
      const b64 = (
        await page.screenshot({ path: join(OUT, `${tag}-entered-1.4s.png`) })
      ).toString('base64');
      const r = await lab.evaluate(analyzePng, {
        b64,
        dsf: vp.dsf,
        jobs: [
          {
            id: 'core',
            rect: {
              x: hero.bodyRect.x + hero.bodyRect.w * 0.3,
              y: hero.bodyRect.y + hero.bodyRect.h * 0.3,
              w: hero.bodyRect.w * 0.4,
              h: hero.bodyRect.h * 0.4,
            },
          },
        ],
      });
      const warmth = r.core.meanRgb[0] - r.core.meanRgb[2];
      if (theme === 'dark')
        check(
          warmth > 100,
          id('M6.lit'),
          'new lockup lit ≤ 1.1 s after the exit',
          `warmth ${fmt(warmth, 0)} at +1.4 s`,
          '> 100',
        );
    }
    const windAfter = await page.evaluate(() => {
      try {
        return window.__festival?.wind?.() ?? null;
      } catch {
        return null;
      }
    });
    const windIdAfter = await page.evaluate(() => !!globalThis.__festivalWind);
    check(
      windIdBefore &&
        windIdAfter &&
        (windAfter === null || Math.abs(windAfter) > 0.3),
      id('M6.gustSurvives'),
      'a gust started 1 s before navigation is still measurable 1 s after',
      `wind() ${fmt(windBefore, 2)} → ${fmt(windAfter, 2)}; singleton ${windIdBefore}→${windIdAfter}`,
      '|W| > 0.3 after; clock never reset',
    );
    if (before.time !== null && after.time !== null)
      check(
        after.time > before.time,
        id('M6.clock'),
        'wind clock never resets on route change',
        `${fmt(before.time, 2)} → ${fmt(after.time, 2)} s`,
        'monotonic',
      );
    if (after.state)
      check(
        after.state.fallCount > 0,
        id('M6.florets'),
        'floret count > 0 after the route change',
        after.state.fallCount,
        '> 0',
      );
    else
      skip(
        id('M6.florets'),
        'floret count > 0 in every frame',
        'state() not exposed',
      );
    skip(
      id('M6.candleFirst'),
      'uLit reaches 0 before the rise passes 8 px',
      'lit/rise per frame are asserted in sim.test.mjs (§4.2 route change)',
    );
  } finally {
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// M7 theme toggle: dusk (light → dark) then morning
// ---------------------------------------------------------------------------

async function themeChecks({ page, lab, layout, id, vp, tag }) {
  const hero = layout?.lanterns?.find((l) => l.hero);
  if (!hero) {
    skip(id('M7'), 'theme toggle', 'no hero lantern');
    return;
  }
  const core = {
    x: hero.bodyRect.x + hero.bodyRect.w * 0.3,
    y: hero.bodyRect.y + hero.bodyRect.h * 0.3,
    w: hero.bodyRect.w * 0.4,
    h: hero.bodyRect.h * 0.4,
  };
  const warmth = async (name) => {
    const b64 = (
      await page.screenshot({
        path: join(OUT, name),
        clip: {
          x: hero.bodyRect.x - 20,
          y: hero.bodyRect.y - 20,
          width: hero.bodyRect.w + 40,
          height: hero.bodyRect.h + 40,
        },
      })
    ).toString('base64');
    const r = await lab.evaluate(analyzePng, {
      b64,
      dsf: vp.dsf,
      jobs: [
        {
          id: 'c',
          rect: {
            x: core.x - hero.bodyRect.x + 20,
            y: core.y - hero.bodyRect.y + 20,
            w: core.w,
            h: core.h,
          },
        },
      ],
    });
    return r.c.meanRgb[0] - r.c.meanRgb[2];
  };
  const w0 = await warmth(`${tag}-theme-before.png`);
  const t0 = await page.evaluate(() => performance.now());
  await page.evaluate(setTheme, 'dark');
  await page.waitForFunction((t) => performance.now() - t >= 350, t0);
  await page.screenshot({
    path: join(OUT, `${tag}-theme-mid-catch-350ms.png`),
  });
  // 120 + 90·2 + 700 = 1000 ms for the third lantern; 100 ms of frame slack.
  await page.waitForFunction((t) => performance.now() - t >= 1100, t0);
  const w1 = await warmth(`${tag}-theme-dusk-1s.png`);
  check(
    w0 < 60 && w1 > 100,
    id('M7.dusk'),
    'candle catch done within 1.1 s of light → dark',
    `warmth ${fmt(w0, 0)} → ${fmt(w1, 0)}`,
    'unlit < 60 → lit > 100',
  );
  const t1 = await page.evaluate(() => performance.now());
  await page.evaluate(setTheme, 'light');
  await page.waitForFunction((t) => performance.now() - t >= 300, t1);
  const w2 = await warmth(`${tag}-theme-morning-300ms.png`);
  check(
    w2 < 60,
    id('M7.snuff'),
    'dark → light snuffs ≤ 300 ms',
    `warmth ${fmt(w2, 0)} at +300 ms`,
    '< 60',
  );
  skip(
    id('M7.noDoubleFrame'),
    'no frame with both a halo and albedo paper at full',
    'uniform state per frame is not observable; verify in code review',
  );
}

// ---------------------------------------------------------------------------
// M8 reduced motion (live flip) and hidden tab
// ---------------------------------------------------------------------------

async function reducedMotionChecks({ page, ctx, id }) {
  const api = await page.evaluate(() => !!window.__festival?.frames);
  if (!api) {
    skip(
      id('M8'),
      'reduced motion / hidden frame counts',
      '__festival.frames() absent',
    );
    return;
  }
  const frames = () => page.evaluate(() => window.__festival.frames());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  const f0 = await frames();
  await page.waitForTimeout(2000);
  const f1 = await frames();
  check(
    f1 - f0 <= 1,
    id('M8.reducedIdle'),
    'reduced motion: frame counter +≤ 1 over 2 s idle',
    f1 - f0,
    '≤ 1',
  );
  await page.evaluate(sweepPointer, { x0: 40, x1: 640, y: 160, ms: 500 });
  const f2 = await frames();
  check(
    f2 - f1 <= 1,
    id('M8.reducedSweep'),
    'reduced motion: +≤ 1 during a sweep',
    f2 - f1,
    '≤ 1',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(600);
  const f3 = await frames();
  await page.waitForTimeout(500);
  const f4 = await frames();
  check(
    f4 > f3,
    id('M8.resumeLoop'),
    'loop resumes when reduced motion is cleared',
    f4 - f3,
    '> 0',
  );
  const thetaBefore = await page.evaluate(() =>
    Array.from(window.__festival.theta?.() ?? []),
  );
  await page.evaluate(setHidden, true);
  await page.waitForTimeout(100);
  const h0 = await frames();
  await page.waitForTimeout(1000);
  const h1 = await frames();
  check(
    h1 - h0 === 0,
    id('M8.hidden'),
    'hidden: frame counter +0 over 1 s',
    h1 - h0,
    '0',
    'visibilityState overridden to hidden',
  );
  await page.evaluate(setHidden, false);
  await page.waitForTimeout(100);
  const thetaAfter = await page.evaluate(() =>
    Array.from(window.__festival.theta?.() ?? []),
  );
  const jump = Math.max(
    0,
    ...thetaBefore.map((v, i) => Math.abs((thetaAfter[i] ?? v) - v)),
  );
  check(
    jump <= 0.03,
    id('M8.resume'),
    'resume without a θ discontinuity > 0.02 rad',
    `${fmt(jump, 3)} rad over the first 100 ms`,
    '≤ 0.02 (+0.01 idle motion)',
  );
  void ctx;
}

// ---------------------------------------------------------------------------
// M9 scroll on /blog/[slug]
// ---------------------------------------------------------------------------

async function scrollChecks({ page, lab, layout, id, vp, tag }) {
  const moon = moonRect(layout?.moon);
  if (!moon) {
    skip(id('M9'), 'scroll moon dim', 'no moon on this layout');
    return;
  }
  const bg = hexRgb(
    (await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim(),
    )) || '#12100d',
  );
  const moonY = async (name) => {
    const b64 = (await page.screenshot({ path: join(OUT, name) })).toString(
      'base64',
    );
    const r = await lab.evaluate(analyzePng, {
      b64,
      dsf: vp.dsf,
      jobs: [{ id: 'm', rect: moon }],
    });
    return r.m.maxY;
  };
  const rest = await moonY(`${tag}-scroll-0.png`);
  await page.mouse.move(720, 600);
  await page.mouse.wheel(0, 520);
  await page.waitForTimeout(900);
  const scrolled = await moonY(`${tag}-scroll-520.png`);
  const ratio =
    (scrolled - luminance(bg)) / Math.max(1e-6, rest - luminance(bg));
  check(
    Math.abs(ratio - 0.6) <= 0.12,
    id('M9.moonDim'),
    'moon at 60% past scrollY 400',
    `luminance ratio ${fmt(ratio, 2)}`,
    '0.6 ± 0.12',
  );
  const state = await page.evaluate(() => {
    try {
      const s = window.__festival?.state?.();
      return s ? s.lanterns.map((l) => l.bob) : null;
    } catch {
      return null;
    }
  });
  if (state)
    check(
      state.every((b) => Math.abs(b) <= 8),
      id('M9.bob'),
      'lanterns bob ≤ 8 px',
      state.map((b) => fmt(b, 1)).join('/'),
      '≤ 8 px',
    );
  else
    skip(
      id('M9.bob'),
      'lanterns bob ≤ 8 px, florets lift ≤ 12 px',
      'state() not exposed',
    );
  await page.mouse.wheel(0, -520);
  await page.waitForTimeout(900);
  const back = await moonY(`${tag}-scroll-back.png`);
  check(
    Math.abs(back - rest) / Math.max(1e-6, rest) <= 0.08,
    id('M9.moonReturn'),
    'moon returns at the top',
    `${fmt(back, 3)} vs rest ${fmt(rest, 3)}`,
    '± 8%',
  );
}

// ---------------------------------------------------------------------------
// Typography census T1–T6 (desktop)
// ---------------------------------------------------------------------------

async function typographyChecks({ page, live, id, route, theme, foundation }) {
  const census = await page.evaluate(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(
      (c) => !c.closest('main'),
    );
    const root =
      document.querySelector('[data-festival-root]') ??
      canvas?.parentElement ??
      null;
    const q = (sel) => (root ? [...root.querySelectorAll(sel)] : []);
    const cs = (el) => getComputedStyle(el);
    const firstFamily = (el) =>
      cs(el)
        .fontFamily.split(',')[0]
        .trim()
        .replace(/^['"]|['"]$/g, '');
    const fontStatus = (family) => {
      const faces = [...document.fonts].filter(
        (f) => f.family.replace(/^['"]|['"]$/g, '') === family,
      );
      return {
        check: document.fonts.check(`11px "${family}"`),
        loaded: faces.some((f) => f.status === 'loaded'),
        faces: faces.length,
      };
    };
    const hanSpans = q('[lang^="zh"]').map((el) => {
      const family = firstFamily(el);
      const wm = cs(el).writingMode;
      const parentWm = el.parentElement ? cs(el.parentElement).writingMode : '';
      return {
        text: el.textContent.trim().slice(0, 12),
        lang: el.getAttribute('lang'),
        family,
        font: fontStatus(family),
        upright: cs(el).textOrientation === 'upright',
        vertical: /vertical/.test(wm) || /vertical/.test(parentWm),
        hasLatin: /[A-Za-z]/.test(el.textContent),
      };
    });
    const latinNoto = [];
    if (root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const text = n.textContent.trim();
        if (!/[A-Za-z]/.test(text)) continue;
        const fam = cs(n.parentElement).fontFamily;
        if (/noto/i.test(fam.split(',')[0])) latinNoto.push(text.slice(0, 20));
      }
    }
    const column = q('figure [class*="column"]')[0] ?? null;
    const poemGlyphs = column
      ? [...column.querySelectorAll('[class*="glyph"]')].map((g) =>
          g.getBoundingClientRect(),
        )
      : [];
    const colophon = q('[class*="colophon"]')[0] ?? null;
    const colophonGlyphs = colophon
      ? [...colophon.querySelectorAll('[class*="glyph"]')].map((g) =>
          g.getBoundingClientRect(),
        )
      : [];
    const figure = q('figure')[0] ?? null;
    const pinyin = q('[class*="pinyin"]')[0] ?? null;
    const visible = (el) =>
      !!el &&
      cs(el).visibility !== 'hidden' &&
      parseFloat(cs(el).opacity) > 0.05 &&
      cs(el).display !== 'none';
    const slipButton = q('button[aria-expanded]')[0] ?? null;
    const strip = q('[class*="strip"]')[0] ?? null;
    const stripHan = strip ? strip.querySelector('[lang^="zh"]') : null;
    const card = q('[class*="card"]')[0] ?? null;
    const answerLink = q('[class*="answerLink"]')[0] ?? null;
    let chPx = null;
    if (card) {
      const probe = document.createElement('span');
      probe.textContent = '0';
      probe.style.cssText =
        'position:absolute;visibility:hidden;white-space:pre';
      card.appendChild(probe);
      chPx = probe.getBoundingClientRect().width;
      probe.remove();
    }
    const textBlocks = [];
    if (root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (n.textContent.trim())
          textBlocks.push({
            text: n.textContent.trim().slice(0, 24),
            owner:
              n.parentElement
                .closest(
                  'figure, [class*="colophon"], [class*="slip"], [class*="moon"], [class*="caption"]',
                )
                ?.className?.toString()
                .slice(0, 40) ?? 'loose',
          });
      }
    }
    const h1s = [...document.querySelectorAll('h1')].map((h) => ({
      text: h.textContent.trim().slice(0, 30),
      family: cs(h).fontFamily,
    }));
    const eyebrows = [...document.querySelectorAll('.eyebrow')].map((e) => ({
      family: cs(e).fontFamily,
      size: cs(e).fontSize,
      tracking: cs(e).letterSpacing,
    }));
    const prose = document.querySelector('.blog-prose');
    let proseCh = null;
    if (prose) {
      const probe = document.createElement('span');
      probe.textContent = '0';
      probe.style.cssText =
        'position:absolute;visibility:hidden;white-space:pre';
      prose.appendChild(probe);
      proseCh = probe.getBoundingClientRect().width;
      probe.remove();
    }
    return {
      proseWidth: prose ? prose.getBoundingClientRect().width : null,
      proseCh,
      hanSpans,
      latinNoto,
      poemGlyphs: poemGlyphs.map((r) => ({ top: r.top, h: r.height })),
      colophonGlyphs: colophonGlyphs.length,
      hasFigure: !!figure,
      hasFigcaption: !!figure?.querySelector('figcaption'),
      figureLabel: figure?.getAttribute('aria-label') ?? null,
      pinyinVisibleIdle: visible(pinyin),
      pinyinExists: !!pinyin,
      slip: slipButton
        ? {
            hit: (() => {
              const r = slipButton.getBoundingClientRect();
              return { w: r.width, h: r.height };
            })(),
            stripUpright: stripHan
              ? cs(stripHan).textOrientation === 'upright' &&
                /vertical/.test(
                  cs(stripHan).writingMode || cs(strip).writingMode,
                )
              : null,
            cardMaxWidthPx: card ? parseFloat(cs(card).maxWidth) : null,
            cardMaxWidthRaw: card ? cs(card).maxWidth : null,
            chPx,
            answerText: answerLink?.textContent.trim() ?? null,
            answerHref: answerLink?.getAttribute('href') ?? null,
            ariaLabel: slipButton.getAttribute('aria-label'),
          }
        : null,
      textBlocks,
      festivalInMain: document.querySelectorAll(
        'main [data-festival], main [class*="festival"]',
      ).length,
      rootInMain: !!root?.closest('main'),
      h1s,
      eyebrows,
      postH1Count: document.querySelectorAll('article h1, .blog-prose h1')
        .length,
      curly: /[‘’“”]/.test(prose?.textContent ?? ''),
      fontsChecked: document.fonts.check('600 96px "Cormorant Garamond"'),
      glyphSpacing:
        poemGlyphs.length > 1
          ? poemGlyphs.slice(1).map((r, i) => r.top - poemGlyphs[i].top)
          : [],
    };
  });
  void live;

  // T1 (typography PR): H1 families, eyebrows, blog measure, one H1, curly quotes.
  const h1Ok =
    census.h1s.length > 0 &&
    census.h1s.every((h) => /Cormorant/i.test(h.family));
  check(
    h1Ok,
    id('T1.h1'),
    'every H1 computes to Cormorant Garamond',
    census.h1s.map((h) => h.family.split(',')[0]).join(' | ') || 'no h1',
    'Cormorant Garamond',
    'typography PR (B1)',
  );
  if (census.eyebrows.length) {
    const eyebrowOk = census.eyebrows.every(
      (e) =>
        /Plex Mono/i.test(e.family) && Math.abs(parseFloat(e.size) - 10) < 0.6,
    );
    check(
      eyebrowOk,
      id('T1.eyebrow'),
      'eyebrows are Plex Mono 10 px',
      census.eyebrows
        .slice(0, 2)
        .map((e) => `${e.family.split(',')[0]} ${e.size} ${e.tracking}`)
        .join(' | '),
      'IBM Plex Mono 10px',
      'typography PR (B2)',
    );
  }
  if (route.key === 'blog-slug') {
    const measureOk =
      census.proseWidth !== null &&
      census.proseCh !== null &&
      census.proseWidth <= 66 * census.proseCh + 2;
    check(
      measureOk,
      id('T1.measure'),
      'blog measure ≤ 66ch',
      census.proseWidth === null
        ? 'no .blog-prose'
        : `${fmt(census.proseWidth, 0)} px = ${fmt(census.proseWidth / census.proseCh, 1)}ch`,
      '≤ 66ch',
      'typography PR (B4)',
    );
    check(
      census.postH1Count <= 1,
      id('T1.oneH1'),
      'one H1 per post',
      census.postH1Count,
      '≤ 1',
    );
    check(
      census.curly,
      id('T1.curly'),
      'curly quotes in rendered HTML',
      census.curly ? 'yes' : 'straight quotes only',
      'curly',
      'typography PR (B4)',
    );
  }

  // T2 Han spans render in the subset.
  if (census.hanSpans.length) {
    const bad = census.hanSpans.filter(
      (s) =>
        !(
          s.font.check &&
          s.font.loaded &&
          s.lang &&
          !s.hasLatin &&
          (!s.vertical || s.upright)
        ),
    );
    check(
      bad.length === 0,
      id('T2.han'),
      'Han spans: subset family loaded, lang set, upright when vertical, no Latin',
      bad.length
        ? bad
            .map(
              (s) =>
                `${s.text}:${s.family} check=${s.font.check} loaded=${s.font.loaded} lang=${s.lang} upright=${s.upright}`,
            )
            .join('; ')
        : `${census.hanSpans.length} spans in ${census.hanSpans[0].family}`,
      'all pass',
    );
    check(
      census.latinNoto.length === 0,
      id('T2.latin'),
      'no Latin text node resolves to a Noto family',
      census.latinNoto.join(', ') || 'none',
      'none',
    );
  } else if (route.key !== 'home') {
    fail(
      id('T2.han'),
      'Han spans present',
      'no [lang^="zh"] spans under the overlay root',
      '≥ 1',
    );
  }

  // T3 poem column + colophon + figure/figcaption + pinyin on focus only.
  const hasVerse = route.key !== 'home';
  if (hasVerse) {
    const spacing = census.glyphSpacing;
    const mean = spacing.length
      ? spacing.reduce((a, b) => a + b, 0) / spacing.length
      : 0;
    const variance = spacing.length
      ? Math.max(
          ...spacing.map((s) => Math.abs(s - mean) / Math.max(1e-6, mean)),
        )
      : 1;
    check(
      census.poemGlyphs.length === 5 && variance < 0.05,
      id('T3.poem'),
      'poem column: 5 upright glyphs, spacing variance < 5%',
      `${census.poemGlyphs.length} glyphs, spacing ${spacing.map((s) => fmt(s, 1)).join('/')}`,
      '5 glyphs, < 5%',
    );
    check(
      census.hasFigure && census.hasFigcaption && !!census.figureLabel,
      id('T3.figure'),
      'figure with aria-label + figcaption present',
      `figure=${census.hasFigure} figcaption=${census.hasFigcaption} label=${census.figureLabel}`,
      'present',
    );
    if (census.pinyinExists) {
      await page.locator('figure').first().focus();
      const focused = await page.evaluate(() => {
        const p = document.querySelector('[class*="pinyin"]');
        const s = getComputedStyle(p);
        return s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.5;
      });
      await page.locator('figure').first().blur();
      check(
        !census.pinyinVisibleIdle && focused,
        id('T3.pinyin'),
        'pinyin only on focus',
        `idle ${census.pinyinVisibleIdle ? 'visible' : 'hidden'}, focused ${focused ? 'visible' : 'hidden'}`,
        'hidden → visible',
      );
    }
  }
  check(
    census.colophonGlyphs === 7,
    id('T3.colophon'),
    'colophon has 7 glyphs',
    census.colophonGlyphs,
    '7',
  );

  // T4 slip (routes with lantern B + slip).
  const expectsSlip = ['blog', 'past-experience', 'schedule-a-call'].includes(
    route.key,
  );
  if (expectsSlip) {
    if (!census.slip)
      fail(
        id('T4.slip'),
        'riddle slip present',
        'no button[aria-expanded] under the overlay root',
        'present',
      );
    else {
      const s = census.slip;
      check(
        s.hit.w >= 44 && s.hit.h >= 44,
        id('T4.hit'),
        'slip button hit area ≥ 44 px',
        `${fmt(s.hit.w, 0)}×${fmt(s.hit.h, 0)}`,
        '≥ 44×44',
      );
      check(
        s.stripUpright === true,
        id('T4.upright'),
        '谜目 upright vertical',
        String(s.stripUpright),
        'vertical-rl + upright',
      );
      const chLimit = s.chPx ? 28 * s.chPx + 1 : null;
      check(
        s.cardMaxWidthRaw === '28ch' ||
          (chLimit !== null && s.cardMaxWidthPx <= chLimit),
        id('T4.card'),
        'card ≤ 28ch',
        `${s.cardMaxWidthRaw} (ch ${fmt(s.chPx, 1)} px)`,
        '≤ 28ch',
      );
      const projects = foundation.projectData?.projects ?? [];
      const match = projects.find((p) => s.answerText?.includes(p.title));
      const hrefOk = match
        ? s.answerHref === match.link
        : /^\/blog\/[^/]+$/.test(s.answerHref ?? '');
      check(
        !!s.answerHref && hrefOk,
        id('T4.answer'),
        '谜底 link resolves to the entry link',
        `${s.answerText} → ${s.answerHref}`,
        match ? match.link : '/blog/<slug>',
      );
      check(
        /^Lantern riddle: .+ Answer: .+/.test(s.ariaLabel ?? ''),
        id('T4.name'),
        'slip aria-label "Lantern riddle: {clue}. Answer: {answer}"',
        s.ariaLabel ?? 'none',
        'pattern',
      );
    }
  }

  // T5 走马灯 strip: titles from data; the canvas font string is internal.
  const featured = foundation.projectData?.featuredProjects ?? [];
  const titles = featured.map((p) => p.title);
  check(
    titles.length === 4,
    id('T5.titles'),
    'four featuredProjects titles feed the strip',
    titles.join(' · '),
    'iCalarms · Personal Env · Med Negotiate · Charades 2026',
  );
  // `strip()` is the DataTexture's userData: { font, fontPx, textWidth, titles }.
  const strip = await page.evaluate(() => {
    try {
      return window.__festival?.strip?.() ?? null;
    } catch {
      return null;
    }
  });
  if (strip) {
    const stripTitles = Array.isArray(strip.titles) ? strip.titles : [];
    check(
      /^600 76px/.test(String(strip.font)) &&
        /Cormorant/.test(String(strip.font)) &&
        titles.length === stripTitles.length &&
        titles.every((t, i) => stripTitles[i] === t),
      id('T5.font'),
      'strip drawn in Cormorant 600 at 76 px with exactly the four titles in order',
      `${strip.font} | ${stripTitles.join(' · ')}`,
      'Cormorant Garamond 600 76px + titles',
    );
  } else
    skip(
      id('T5.font'),
      'strip canvas font string',
      `__festival.strip() not exposed; fonts.check(600 96px Cormorant) = ${census.fontsChecked}`,
    );

  // T6 text-node census.
  const owners = new Map();
  for (const b of census.textBlocks)
    owners.set(b.owner, (owners.get(b.owner) ?? 0) + 1);
  const groups = [...owners.keys()].filter((k) => k !== 'loose').length;
  const loose = owners.get('loose') ?? 0;
  check(
    groups <= 5 && loose === 0,
    id('T6.census'),
    'overlay text ≤ column + colophon + translation + pinyin + slip (+ moon name), no loose text',
    `${groups} blocks, ${loose} loose, ${census.textBlocks.length} text nodes`,
    '≤ 5 blocks, 0 loose',
  );
  check(
    census.festivalInMain === 0 && !census.rootInMain,
    id('T6.notInMain'),
    'no festival node inside a page component',
    `main [data-festival|class*=festival]: ${census.festivalInMain}; root in main: ${census.rootInMain}`,
    '0 / false',
  );
  void theme;
}

async function mobileTextChecks({ page, id }) {
  const count = await page.evaluate(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(
      (c) => !c.closest('main'),
    );
    const root =
      document.querySelector('[data-festival-root]') ?? canvas?.parentElement;
    if (!root) return -1;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n = 0;
    let node;
    while ((node = walker.nextNode())) if (node.textContent.trim()) n++;
    return n;
  });
  check(
    count === 0,
    id('T6.mobileNoText'),
    'nothing festival-textual on mobile',
    count === -1 ? 'no root' : `${count} text nodes`,
    '0',
  );
}

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

async function a11yChecks({ page, live, id, route, theme }) {
  const a = await page.evaluate(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(
      (c) => !c.closest('main'),
    );
    const root =
      document.querySelector('[data-festival-root]') ??
      canvas?.parentElement ??
      null;
    const main = document.querySelector('main');
    const after = (el) =>
      !!el &&
      !!main &&
      !!(main.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    const slip = root?.querySelector('button[aria-expanded]') ?? null;
    const moon = root?.querySelector('button[aria-label^="Full moon"]') ?? null;
    const name = (el) =>
      el?.getAttribute('aria-label') || el?.textContent.trim() || '';
    const cs = (el) => getComputedStyle(el);
    const parse = (c) => {
      const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      return { rgb: m.slice(0, 3), a: m[3] ?? 1 };
    };
    const composite = (fg, bg) =>
      fg.rgb.map((v, i) => Math.round(v * fg.a + bg[i] * (1 - fg.a)));
    const pageBg = parse(cs(document.body).backgroundColor);
    const htmlBg = parse(cs(document.documentElement).backgroundColor);
    const bg = pageBg.a > 0 ? pageBg.rgb : htmlBg.rgb;
    const clue = root?.querySelector('[class*="clue"]') ?? null;
    const card = root?.querySelector('[class*="card"]') ?? null;
    const translation = root?.querySelector('[class*="translation"]') ?? null;
    const points = [];
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        label: (el.getAttribute('aria-label') || el.textContent || el.tagName)
          .trim()
          .slice(0, 18),
      };
    };
    for (const el of document.querySelectorAll(
      'header a, header button, nav a, nav button, main [class*="dockLink"], h1, main a[href*="schedule"], main a[href^="/"]',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && r.top >= 0 && r.bottom <= innerHeight)
        points.push(centre(el));
      if (points.length >= 12) break;
    }
    const offenders = points
      .filter((p) => {
        const hit = document.elementFromPoint(p.x, p.y);
        return hit && root && root.contains(hit);
      })
      .map((p) => p.label);
    return {
      slip: slip
        ? { name: name(slip), after: after(slip), tabbable: slip.tabIndex >= 0 }
        : null,
      moon: moon
        ? { name: name(moon), after: after(moon), tabbable: moon.tabIndex >= 0 }
        : null,
      canvasAriaHidden: canvas?.getAttribute('aria-hidden') === 'true',
      clueColor: clue
        ? composite(
            parse(cs(clue).color),
            card ? composite(parse(cs(card).backgroundColor), bg) : bg,
          )
        : null,
      cardBg: card ? composite(parse(cs(card).backgroundColor), bg) : null,
      translationColor: translation
        ? composite(parse(cs(translation).color), bg)
        : null,
      bg,
      points: points.length,
      offenders,
    };
  });
  const expectsSlip = ['blog', 'past-experience', 'schedule-a-call'].includes(
    route.key,
  );
  if (expectsSlip) {
    check(
      !!a.slip && a.slip.name.length > 0 && a.slip.after && a.slip.tabbable,
      id('A.slipButton'),
      'slip is a named, keyboard-reachable button after main',
      a.slip ? `${a.slip.name.slice(0, 40)} after=${a.slip.after}` : 'absent',
      'button with name, after <main>',
    );
    if (a.slip) {
      await page.locator('button[aria-expanded]').first().focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      const open = await page.evaluate(() =>
        document
          .querySelector('button[aria-expanded]')
          ?.getAttribute('aria-expanded'),
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const closed = await page.evaluate(() =>
        document
          .querySelector('button[aria-expanded]')
          ?.getAttribute('aria-expanded'),
      );
      check(
        open === 'true' && closed === 'false',
        id('A.escape'),
        'Enter opens the slip, Escape closes it',
        `open=${open} closed=${closed}`,
        'true → false',
      );
    }
    if (a.clueColor && a.cardBg) {
      const c = contrast(a.clueColor, a.cardBg);
      check(
        c >= 7,
        id('A.slipContrast'),
        'slip ink contrast ≥ 7:1',
        `${fmt(c, 2)}:1 rgb(${a.clueColor}) on rgb(${a.cardBg})`,
        '≥ 7:1',
      );
    }
  }
  if (route.key !== 'home') {
    check(
      !!a.moon && a.moon.name.length > 0 && a.moon.after && a.moon.tabbable,
      id('A.moonButton'),
      'moon is a named, keyboard-reachable button after main',
      a.moon ? `${a.moon.name} after=${a.moon.after}` : 'absent',
      'aria-label "Full moon, …"',
    );
    if (a.translationColor) {
      const c = contrast(a.translationColor, a.bg);
      check(
        c >= 4.5,
        id('A.translationContrast'),
        `translation contrast ≥ 4.5:1 (${theme})`,
        `${fmt(c, 2)}:1 rgb(${a.translationColor}) on rgb(${a.bg})`,
        '≥ 4.5:1',
      );
    }
  }
  check(
    a.canvasAriaHidden,
    id('A.canvasHidden'),
    'festival canvas is aria-hidden',
    String(a.canvasAriaHidden),
    'true',
  );
  check(
    a.offenders.length === 0,
    id('A.elementFromPoint'),
    `elementFromPoint on ${a.points} page targets never returns a festival node`,
    a.offenders.join(', ') || `${a.points} points clear`,
    'none',
  );
  void live;
}

// ---------------------------------------------------------------------------
// Perf rows (§7.5) that do not need a GPU
// ---------------------------------------------------------------------------

async function perfChecks({ page, live, vp, route, responses, layout }) {
  const r = route.path;
  const expectedContexts = route.key === 'home' ? 2 : 1;
  perfRow(
    'webglContexts',
    r,
    live.webglContexts,
    expectedContexts,
    live.webglContexts === expectedContexts,
    `${vp.mobile ? 'mobile' : 'desktop'} (counted getContext calls)`,
  );
  const info = live.rendererInfo;
  if (info?.render) {
    perfRow('drawCalls', r, info.render.calls, '≤ 7', info.render.calls <= 7);
    perfRow(
      'triangles',
      r,
      info.render.triangles,
      '≤ 8000',
      info.render.triangles <= 8000,
    );
    perfRow(
      'programs',
      r,
      info.programs?.length ?? info.programs,
      '≤ 7',
      (info.programs?.length ?? info.programs ?? 0) <= 7,
    );
    perfRow(
      'textures',
      r,
      info.memory?.textures,
      '≤ 5',
      (info.memory?.textures ?? 99) <= 5,
    );
    perfRow(
      'geometries',
      r,
      info.memory?.geometries,
      '≤ 6',
      (info.memory?.geometries ?? 99) <= 6,
    );
  } else {
    perfRow(
      'drawCalls',
      r,
      null,
      '≤ 7',
      null,
      '__festival.rendererInfo() unavailable',
    );
  }
  if (layout) {
    perfRow(
      'lanternInstances',
      r,
      layout.lanterns.length,
      vp.mobile ? '≤ 1' : '≤ 3',
      layout.lanterns.length <= (vp.mobile ? 1 : 3),
    );
    perfRow(
      'fallInstances',
      r,
      layout.florets.count,
      vp.mobile ? '≤ 12' : '≤ 36',
      layout.florets.count <= (vp.mobile ? 12 : 36),
    );
  }
  if (live.canvas) {
    const cap = vp.mobile || route.key === 'home' ? 1 : 1.5;
    perfRow(
      'dpr',
      r,
      fmt(live.canvas.dpr, 2),
      `≤ ${cap}`,
      live.canvas.dpr <= cap + 0.01,
      `${vp.mobile ? 'mobile' : 'desktop'}`,
    );
  }
  if (live.hasApi && typeof live.frames === 'number') {
    const f0 = await page.evaluate(() => window.__festival.frames());
    await page.waitForTimeout(2000);
    const f1 = await page.evaluate(() => window.__festival.frames());
    perfRow(
      'rendersPerSecond',
      r,
      fmt((f1 - f0) / 2, 1),
      '≤ 60',
      (f1 - f0) / 2 <= 61,
      'SwiftShader: low is expected, high is the bug',
    );
  }
  const frameMs = await page.evaluate(() => {
    try {
      return window.__festival?.frameMs?.() ?? null;
    } catch {
      return null;
    }
  });
  if (frameMs !== null)
    perfRow('renderCpuMs', r, fmt(frameMs, 2), '≤ 1 ms', frameMs <= 1);
  else if (!vp.mobile)
    perfRow(
      'renderCpuMs',
      r,
      null,
      '≤ 1 ms',
      null,
      '__festival.frameMs() not exposed',
    );
  perfRow(
    'settledMs',
    r,
    live.timeline.settled !== undefined
      ? fmt(
          live.timeline.settled -
            Math.max(
              live.timeline.canvas,
              Math.min(
                live.timeline.fontsReady ?? Infinity,
                live.timeline.canvas + 800,
              ),
            ),
          0,
        )
      : null,
    '≤ 4500',
    live.timeline.settled !== undefined
      ? live.timeline.settled - live.timeline.canvas <= 4500
      : false,
    'wall clock on SwiftShader',
  );
  perfRow(
    'benchSettledMs',
    r,
    null,
    '≤ 8000',
    null,
    'data-bench-settled is not published by the Bench in this tree',
  );

  // Payload: font, moon, festival chunks (dev serves unminified; gz only asserted when compressed).
  if (route.key === 'blog' && !vp.mobile) {
    const sized = [];
    for (const resp of responses) {
      const url = resp.url();
      if (!/NotoSerifSC|moon-nearside|festival|MidAutumn/i.test(url)) continue;
      try {
        const body = await resp.body();
        sized.push({
          url: url.replace(BASE_URL, ''),
          bytes: body.length,
          encoding: resp.headers()['content-encoding'] ?? 'identity',
        });
      } catch {}
    }
    const font = sized.find((s) => /NotoSerifSC|\.woff2/.test(s.url));
    const moon = sized.find((s) => /moon-nearside/.test(s.url));
    const chunks = sized.filter((s) => /\.js/.test(s.url));
    perfRow(
      'fontBytes',
      r,
      font?.bytes ?? null,
      '≤ 12288',
      font ? font.bytes <= 12288 : null,
      font ? font.url : 'no festival font request seen',
    );
    perfRow(
      'moonBytes',
      r,
      moon?.bytes ?? null,
      '≤ 61440',
      moon ? moon.bytes <= 61440 : null,
      moon ? moon.url : 'no moon texture request seen',
    );
    const chunkBytes = chunks.reduce((a, c) => a + c.bytes, 0);
    const compressed = chunks.every((c) => c.encoding !== 'identity');
    perfRow(
      'festivalChunkBytes',
      r,
      chunkBytes,
      '≤ 46080 gz (excl. three)',
      chunks.length && compressed ? chunkBytes <= 46080 : null,
      `${chunks.length} chunks, ${compressed ? 'compressed' : 'dev/uncompressed: recorded, not asserted'}`,
    );
  }
}

/** Heap delta + LCP on /blog: flag-on vs flag-off in the SwiftShader browser. */
async function baselineComparisons({ browser }) {
  const vp = VIEWPORTS.desktop;
  const load = async (flag) => {
    const ctx = await newContext(browser, vp, 'dark');
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    try {
      await page.goto(festivalUrl(BASE_URL, '/blog', { flag }), {
        waitUntil: 'load',
      });
      if (flag === '1') await waitForLayer(page);
      await waitSettled(page, 6000);
      await page.waitForTimeout(1500);
      return page.evaluate(readOverlay);
    } finally {
      await ctx.close();
    }
  };
  const on = await load('1');
  const off = await load('0');
  if (on.heap !== null && off.heap !== null) {
    const delta = (on.heap - off.heap) / 1048576;
    perfRow(
      'heapDeltaMB',
      '/blog',
      fmt(delta, 1),
      '≤ 12',
      delta <= 12,
      'usedJSHeapSize flag-on − flag-off (settled)',
    );
  } else
    perfRow(
      'heapDeltaMB',
      '/blog',
      null,
      '≤ 12',
      null,
      'performance.memory unavailable',
    );
  if (on.lcp && off.lcp) {
    const same = on.lcp.element === off.lcp.element;
    const within = on.lcp.t <= off.lcp.t + 50;
    perfRow('lcpElement', '/blog', on.lcp.element, off.lcp.element, same);
    perfRow(
      'lcpMs',
      '/blog',
      fmt(on.lcp.t, 0),
      `≤ ${fmt(off.lcp.t + 50, 0)} (baseline + 50)`,
      within,
      'dev server timings are noisy; compare across a few runs',
    );
  } else
    perfRow(
      'lcpMs',
      '/blog',
      null,
      'baseline + 50 ms',
      null,
      'no LCP entries observed',
    );
}

// ---------------------------------------------------------------------------
// GPU timing pass (§7.5 rAF-gap rows); skipped on SwiftShader and says so
// ---------------------------------------------------------------------------

async function timingPass({ chromium, exe }) {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: exe,
      headless: true,
      args: [...COMMON_ARGS, '--ignore-gpu-blocklist'],
    });
  } catch (err) {
    perfRow(
      'rafGapP95',
      '/',
      null,
      '≤ 12 ms',
      null,
      `GPU browser failed to launch: ${err.message}`,
    );
    return;
  }
  try {
    const probe = await browser.newPage();
    const renderer = await probe.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl
          ? 'unknown'
          : 'none';
    });
    await probe.close();
    perf.gpuRenderer = renderer;
    if (/SwiftShader/i.test(renderer) || renderer === 'none') {
      const why = `GPU timings skipped: headless renderer is "${renderer}" (SwiftShader); run on a GPU host for the frame-gap rows`;
      for (const [metric, route] of [
        ['rafGapP95', '/'],
        ['rafGapP95', '/blog'],
        ['rafGapP95', '/orbital'],
        ['sweepGapP95', '/'],
        ['settledMsGpu', '/blog'],
      ])
        perfRow(metric, route, null, 'see §7.5', null, why);
      return;
    }
    for (const route of ['/', '/blog', '/orbital']) {
      const ctx = await newContext(browser, VIEWPORTS.desktop, 'dark');
      const page = await ctx.newPage();
      page.setDefaultTimeout(30000);
      try {
        await page.goto(festivalUrl(BASE_URL, route), { waitUntil: 'load' });
        await waitForLayer(page);
        const settled = await waitSettled(page);
        if (route === '/blog')
          perfRow(
            'settledMsGpu',
            route,
            settled === null ? null : fmt(settled, 0),
            '≤ 4500',
            settled !== null && settled <= 4500,
            `GPU: ${renderer}`,
          );
        await page.waitForTimeout(6000); // let the first gust pass
        await page.mouse.move(720, 450);
        const idle = await page.evaluate(sampleFrameGaps, 3);
        const budget = route === '/' ? 12 : 10;
        perfRow(
          'rafGapP95',
          route,
          fmt(idle.p95, 1),
          `≤ ${budget} ms`,
          idle.p95 <= budget,
          `max ${fmt(idle.max, 1)}, >33 ms: ${idle.over33}, long tasks ${idle.longTasks}, ${renderer}`,
        );
        perfRow(
          'rafGapsOver33',
          route,
          idle.over33,
          route === '/' ? '0' : '≤ 1',
          idle.over33 <= (route === '/' ? 0 : 1),
        );
        if (route === '/') {
          perfRow(
            'longTasks',
            route,
            idle.longTasks,
            '0',
            idle.longTasks === 0,
          );
          const sampling = page.evaluate(sampleFrameGaps, 2);
          await page.evaluate(sweepPointer, {
            x0: 100,
            x1: 1340,
            y: 450,
            ms: 1000,
          });
          const sweep = await sampling;
          perfRow(
            'sweepGapP95',
            route,
            fmt(sweep.p95, 1),
            '≤ 17 ms',
            sweep.p95 <= 17,
            `max ${fmt(sweep.max, 1)} (≤ 34)`,
          );
          perfRow(
            'sweepGapMax',
            route,
            fmt(sweep.max, 1),
            '≤ 34 ms',
            sweep.max <= 34,
          );
          perfRow(
            'benchResettleS',
            route,
            null,
            '≤ 3 s',
            null,
            'data-bench-settled not published by the Bench',
          );
        }
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// V10: mobile flag-on vs flag-off text-rect diffs; identical captures on the
// two silent mobile routes
// ---------------------------------------------------------------------------

async function mobileFlagOffChecks({
  browser,
  lab,
  page,
  vp,
  theme,
  route,
  tag,
  onShot,
}) {
  const id = (k) => `${k}@${tag}`;
  const textRects = await page.evaluate(readTextBlocks);
  const on = onShot ?? (await shot(page, `${tag}-settled.png`));
  const ctx = await newContext(browser, vp, theme);
  const off = await ctx.newPage();
  off.setDefaultTimeout(30000);
  try {
    await off.goto(festivalUrl(BASE_URL, route.path, { flag: '0' }), {
      waitUntil: 'load',
    });
    await off.waitForTimeout(3500);
    await off.mouse.move(5, 5);
    const offShot = await shot(off, `${tag}-flag-off.png`);
    const diffs = await lab.evaluate(diffPng, {
      a: on,
      b: offShot,
      dsf: vp.dsf,
      rects: textRects,
    });
    const bad = diffs.filter((d) => d.diff > 0);
    check(
      bad.length === 0,
      id('V10.text'),
      'text-block rects identical flag-on vs flag-off',
      bad.length
        ? bad
            .slice(0, 3)
            .map(
              (d) =>
                `${fmt(d.rect.x, 0)},${fmt(d.rect.y, 0)} ${d.diff}/${d.total}`,
            )
            .join('; ')
        : `${diffs.length} rects, 0 px differ`,
      '0 differing px',
      'main h1,h2,p,li,a',
    );
    if (route.key === 'past-experience' || route.key === 'schedule-a-call') {
      const iframes = await page.evaluate(() =>
        [...document.querySelectorAll('iframe')].map((f) => {
          const r = f.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        }),
      );
      const whole = await lab.evaluate(diffPng, {
        a: on,
        b: offShot,
        dsf: vp.dsf,
        rects: [{ x: 0, y: 0, w: vp.width, h: vp.height }, ...iframes],
      });
      const total = whole[0].diff;
      const inIframes = whole.slice(1).reduce((a, d) => a + d.diff, 0);
      check(
        total - inIframes === 0,
        id('V10.identical'),
        'flag-on and flag-off mobile captures identical',
        `${total} px differ (${inIframes} inside iframes)`,
        '0 outside iframes',
        'Calendly iframe content varies per load',
      );
    }
  } finally {
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Kill switch
// ---------------------------------------------------------------------------

async function killSwitchChecks({ browser, base, label }) {
  const id = (k) => `${k}@${label}`;
  const ctx = await newContext(browser, VIEWPORTS.desktop, 'dark');
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const fontRequests = [];
  page.on('request', (r) => {
    if (/NotoSerifSC|festival.*\.woff2/i.test(r.url()))
      fontRequests.push(r.url());
  });
  try {
    // `query`: `/blog?festival=0` first (it persists to localStorage), then
    // plain loads must stay off. `enabled:false`: every load is plain.
    const steps =
      label === 'query'
        ? [
            ['/blog', '0'],
            ['/', null],
            ['/blog', null],
            ['/terminal', null],
          ]
        : [
            ['/blog', null],
            ['/', null],
            ['/terminal', null],
          ];
    for (const [path, flag] of steps) {
      const url =
        flag === null
          ? `${base}${path}?bench-debug=1`
          : festivalUrl(base, path, { flag });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(3000);
      const o = await page.evaluate(readOverlay);
      const expectedCanvases = path === '/' ? 1 : 0;
      const ok =
        o.festivalAttr === null &&
        o.canvasCount === expectedCanvases &&
        !o.hasApi &&
        !o.hasRoot &&
        (o.webglContexts ?? 0) === expectedCanvases;
      check(
        ok,
        id(`kill${path}`),
        `${label}: zero festival DOM, no second canvas, no __festival on ${path}${flag === null && label === 'query' ? ' (persisted)' : ''}`,
        `data-festival=${o.festivalAttr} canvases=${o.canvasCount} webgl=${o.webglContexts} api=${o.hasApi} root=${o.hasRoot}`,
        `no attr, ${expectedCanvases} canvas, no api`,
      );
    }
    check(
      fontRequests.length === 0,
      id('kill.font'),
      `${label}: no festival font request`,
      fontRequests.length ? fontRequests[0] : 'none',
      'none',
    );
  } finally {
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printTable() {
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
  for (const r of results) counts[r.status]++;
  console.log('\n' + '='.repeat(120));
  console.log('FESTIVAL GAUNTLET RESULTS');
  console.log('='.repeat(120));
  const w = { status: 4, id: 44, measured: 48 };
  console.log(
    `${'STAT'.padEnd(w.status)}  ${'ASSERTION'.padEnd(w.id)}  ${'MEASURED'.padEnd(w.measured)}  EXPECTED / NOTE`,
  );
  for (const r of results) {
    const tail = [r.expected, r.note].filter(Boolean).join(' · ');
    console.log(
      `${r.status.padEnd(w.status)}  ${r.id.slice(0, w.id).padEnd(w.id)}  ${String(
        r.measured ?? '',
      )
        .slice(0, w.measured)
        .padEnd(w.measured)}  ${tail}`,
    );
  }
  console.log('-'.repeat(120));
  console.log(
    `PASS ${counts.PASS}  FAIL ${counts.FAIL}  SKIP ${counts.SKIP}   (PNGs: ${OUT}; perf: ${PERF_OUT})`,
  );
  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { chromium } = await loadPlaywright();
  const exe = chromiumExecutable();
  const foundation = await loadFoundation();
  const browser = await chromium.launch({
    executablePath: exe,
    headless: true,
    args: [...SWIFTSHADER_ARGS, ...COMMON_ARGS],
  });
  // A scratch page for pixel analysis (decodes PNGs with the browser's canvas).
  const labCtx = await browser.newContext();
  const lab = await labCtx.newPage();
  await lab.goto('about:blank');

  const routes = ONLY
    ? ROUTES.filter((r) =>
        ONLY.some((s) => r.key.includes(s) || r.path.includes(s)),
      )
    : ROUTES;
  try {
    for (const route of routes) {
      for (const vpName of Object.keys(VIEWPORTS)) {
        for (const theme of THEMES) {
          console.log(`\n--- ${route.path} ${vpName} ${theme} ---`);
          await guarded(`combo@${route.key}-${vpName}-${theme}`, () =>
            runCombo({
              browser,
              lab,
              foundation,
              route,
              vpName,
              theme,
              colour: 'mono',
            }),
          );
        }
      }
      if (route.key === 'blog' && !QUICK) {
        for (const colour of COLOUR_THEMES.filter((c) => c !== 'mono')) {
          console.log(`\n--- /blog desktop dark ${colour} ---`);
          await guarded(`combo@blog-desktop-dark-${colour}`, () =>
            runCombo({
              browser,
              lab,
              foundation,
              route,
              vpName: 'desktop',
              theme: 'dark',
              colour,
            }),
          );
        }
      }
    }
    // V6 verdicts (best crop across settled / gust / M4 window).
    for (const [key, v] of v6State) {
      check(
        v.best >= 3,
        key,
        `走马灯 legible on the ${v.hero} px hero (best crop)`,
        `${v.best} letter-width columns ≥ 12% darker than adjacent paper`,
        '≥ 3',
        v.hero === 72
          ? 'fail → festival.revolvingOnHome=false; plus a human read'
          : 'plus a human read',
      );
    }
    if (
      !ONLY ||
      ONLY.some((s) => 'blog'.includes(s) || 'past-experience'.includes(s))
    ) {
      for (const [vpName, theme] of [
        ['desktop', 'dark'],
        ['desktop', 'light'],
        ['mobile', 'dark'],
      ]) {
        console.log(
          `\n--- route change /blog → /past-experience ${vpName} ${theme} ---`,
        );
        await guarded(`M6@${vpName}-${theme}`, () =>
          routeChangeRun({ browser, lab, foundation, vpName, theme }),
        );
      }
    }
    console.log('\n--- baselines (heap, LCP) ---');
    await guarded('baselines', () => baselineComparisons({ browser }));
    console.log('\n--- kill switch ---');
    await guarded('kill:query', () =>
      killSwitchChecks({ browser, base: BASE_URL, label: 'query' }),
    );
    if (OFF_URL)
      await guarded('kill:env', () =>
        killSwitchChecks({ browser, base: OFF_URL, label: 'enabled:false' }),
      );
    else
      skip(
        'kill:enabled-false',
        '`enabled: false` / NEXT_PUBLIC_FESTIVAL=0 removes the mount',
        'needs a second server: pass --off-url <server started with NEXT_PUBLIC_FESTIVAL=0>',
      );
    // V9 grain: z-order check on /blog.
    await guarded('V9', async () => {
      const ctx = await newContext(browser, VIEWPORTS.desktop, 'dark');
      const page = await ctx.newPage();
      try {
        await page.goto(festivalUrl(BASE_URL, '/blog'), { waitUntil: 'load' });
        await waitForLayer(page);
        const z = await page.evaluate(() => {
          const grain = document.querySelector('.grain-overlay');
          const canvas = [...document.querySelectorAll('canvas')].find(
            (c) => !c.closest('main'),
          );
          const root =
            document.querySelector('[data-festival-root]') ??
            canvas?.parentElement ??
            null;
          // The marked root is `display: contents`; its fixed children carry z.
          const fixed = canvas?.parentElement ?? root;
          const zi = (el) =>
            el ? parseInt(getComputedStyle(el).zIndex, 10) : NaN;
          return {
            grain: zi(grain),
            root: zi(fixed),
            grainPos: grain ? getComputedStyle(grain).position : null,
            rootPos: fixed ? getComputedStyle(fixed).position : null,
          };
        });
        check(
          Number.isFinite(z.grain) &&
            Number.isFinite(z.root) &&
            z.grain > z.root &&
            z.root < 999,
          'V9.grain',
          'grain (z 999) paints over the festival root (z ≤ 2)',
          `grain z ${z.grain} ${z.grainPos}, root z ${z.root} ${z.rootPos}`,
          'grain > root, root < 999',
        );
      } finally {
        await ctx.close();
      }
    });
  } finally {
    await labCtx.close();
    await browser.close();
  }
  if (TIMING === 'gpu') {
    console.log('\n--- GPU timing pass ---');
    await guarded('timing', () => timingPass({ chromium, exe }));
  } else
    skip(
      'timing',
      'GPU frame-timing rows',
      TIMING === 'off'
        ? '--timing off / --quick'
        : `unknown --timing ${TIMING}`,
    );

  const counts = printTable();
  perf.summary = counts;
  perf.results = results;
  writeFileSync(PERF_OUT, JSON.stringify(perf, null, 2));
  process.exit(counts.FAIL > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
