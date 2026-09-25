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
 *   --out       PNG directory (default <scratch>/shots/festival-gauntlet)
 *   --perf-out  perf JSON path (default <scratch>/shots/festival-perf.json)
 *
 * Environment:
 *   FESTIVAL_SCRATCH     <scratch> above (default <os.tmpdir()>/festival-gauntlet)
 *   PLAYWRIGHT_CORE_DIR  a directory whose node_modules holds playwright-core
 *                        (default <scratch>/pw)
 *   --off-url   a second server BUILT with NEXT_PUBLIC_FESTIVAL=0, for the
 *               `enabled: false` half of the kill-switch check (optional).
 *               The variable is a build-time switch: the static routes
 *               (/blog, /blog/[slug], /past-experience, /schedule-a-call)
 *               bake the mount into their HTML at `next build`, so a server
 *               merely *started* with it still serves the layer there.
 *   --gpu       launch the capture browser on the real GPU (Metal on this
 *               Mac: `--use-angle=metal --ignore-gpu-blocklist`) instead of
 *               SwiftShader, so the wall-timed rows (M5 sweep, M9 scroll)
 *               run at sim speed and stop being SKIPPED. Pixels are then
 *               not stable run to run; use it for the motion rows.
 *   --only      comma list of route substrings to run (default: all)
 *   --prod      the target is a production build, so the payload rows
 *               (`perf:festivalChunkBytes`, `perf:heapDeltaMB`) are
 *               asserted. Without it the script sniffs the target: a
 *               `next dev` server serves unminified, uncompressed chunks
 *               behind the HMR client, so those two rows are SKIPPED with a
 *               note instead of failing against numbers that mean nothing.
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
import { homedir, tmpdir } from 'node:os';
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

/**
 * Where PNGs, the perf JSON and the playwright-core install live by default:
 * `FESTIVAL_SCRATCH` (a session scratchpad) or the OS temp dir. `--out`,
 * `--perf-out` and `PLAYWRIGHT_CORE_DIR` override the three uses separately.
 */
const SCRATCH =
  process.env.FESTIVAL_SCRATCH ?? join(tmpdir(), 'festival-gauntlet');
const BASE_URL = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const OFF_URL = args['off-url']?.replace(/\/$/, '') ?? null;
const OUT = resolve(args.out ?? join(SCRATCH, 'shots', 'festival-gauntlet'));
const PERF_OUT = resolve(
  args['perf-out'] ?? join(SCRATCH, 'shots', 'festival-perf.json'),
);
const ONLY = args.only ? args.only.split(',').map((s) => s.trim()) : null;
/** `--prod`: the target is a production build, so the payload rows count. */
const PROD = args.prod === '1';
const QUICK = args.quick === '1';
const GPU = args.gpu === '1';
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
const GPU_ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist'];
const RENDER_ARGS = GPU ? GPU_ARGS : SWIFTSHADER_ARGS;
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
const GUST_RESPONSE_S = 0.3; // the pendulum answers within this of the front
const PERIOD_TOLERANCE = 0.08; // M4
const SWEEP_PX_PER_S = 1200; // M5
const HALO_WIDTH_FACTOR = 2.8; // §2.2
const POOL_WIDTH_FACTOR = 3.2;
const POOL_ASPECT = 1.35;
/** Pool centre: 0.4 body-heights below the BOTTOM collar (§2.2), i.e. 0.9 below the body centre. */
const POOL_DROP_BODY_HEIGHTS = 0.5 + 0.4;
/** Tassel: cone 0.32 + gap 0.08 body widths below the bottom collar (§5.1). */
const TASSEL_DROP_FACTOR = 0.4;

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

/**
 * Is the page served by `next dev`? The two payload rows
 * (`festivalChunkBytes`, `heapDeltaMB`) measure the shipped bundle, and a
 * dev server ships unminified, uncompressed chunks behind an HMR client:
 * the numbers come out ~5× over budget and mean nothing. Dev is recognised
 * by its unhashed chunk names (`webpack.js`, `main-app.js` — production
 * hashes every one), the `/_next/static/development/` prefix and the dev
 * overlay element. `--prod` asserts the target is a production build for a
 * deployment the heuristic cannot read.
 */
async function isDevTarget(page) {
  if (PROD) return false;
  try {
    return await page.evaluate(() => {
      const srcs = [...document.querySelectorAll('script[src]')].map(
        (s) => s.getAttribute('src') ?? '',
      );
      return (
        srcs.some((s) =>
          /\/_next\/static\/(chunks\/(webpack|main-app)\.js|development\/)/.test(
            s,
          ),
        ) ||
        !!document.querySelector('nextjs-portal') ||
        'webpackHotUpdate' in window
      );
    });
  } catch {
    return false;
  }
}

const DEV_NOTE =
  'dev server: unminified, uncompressed bundles behind the HMR client — ' +
  'measure on a production build (next build && next start, then --prod)';

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
  // Client navigations: Next pushes history when the new route commits.
  const pushState = history.pushState;
  history.pushState = function (...args) {
    const r = pushState.apply(this, args);
    delete g.t.nav;
    delete g.sim.nav;
    mark('nav');
    return r;
  };
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
    moonNight: safe(() => api?.moon?.()?.night) ?? null,
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
    // `hole` / `holes`: CSS-px rects whose pixels are left out (a ring
    // around a body; the lanterns' halos across a column-edge strip).
    const holes = [...(job.holes ?? []), ...(job.hole ? [job.hole] : [])].map(
      (r) => ({
        x0: Math.round(r.x * dsf) - x,
        y0: Math.round(r.y * dsf) - y,
        x1: Math.round((r.x + r.w) * dsf) - x,
        y1: Math.round((r.y + r.h) * dsf) - y,
      }),
    );
    let maxY = 0;
    let sumY = 0;
    let maxRgb = [0, 0, 0];
    const sum = [0, 0, 0];
    const ys = [];
    let n = 0;
    const rows = job.rows ? new Float64Array(h) : null;
    const cols = job.cols ? new Float64Array(w) : null;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (
          holes.some(
            (hole) =>
              i >= hole.x0 && i < hole.x1 && j >= hole.y0 && j < hole.y1,
          )
        )
          continue;
        n++;
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
    if (n === 0) {
      results[job.id] = null;
      continue;
    }
    ys.sort((a, b) => b[0] - a[0]);
    const decile = ys.slice(0, Math.max(1, Math.floor(ys.length / 10)));
    const mid = decile[Math.floor(decile.length / 2)];
    const dark = ys.slice(-Math.max(1, Math.floor(ys.length / 10)));
    const darkMid = dark[Math.floor(dark.length / 2)];
    results[job.id] = {
      maxY,
      meanY: sumY / n,
      maxRgb,
      brightDecileRgb: [mid[1], mid[2], mid[3]],
      // The median of the darkest decile: the local page under no overlay.
      darkDecileRgb: [darkMid[1], darkMid[2], darkMid[3]],
      meanRgb: sum.map((v) => Math.round(v / n)),
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

/**
 * rAF loop in the page: samples θ arrays (and sim time) for `seconds` of
 * sim time when the layer exposes its clock (wall time otherwise; `useSim`
 * false forces wall time, for the wall-timed pointer sweep), capped at 4×
 * that in wall time. Resolves `{ samples, covered }`, `covered` being the
 * fraction of the requested window actually sampled.
 */
function sampleTheta({ seconds, useSim = true }) {
  return new Promise((resolve) => {
    const g = window.__gauntlet;
    const api = window.__festival;
    const samples = [];
    const start = performance.now();
    const simStart = useSim ? (api?.time?.() ?? null) : null;
    const elapsed = () =>
      simStart === null
        ? (performance.now() - start) / 1000
        : (api?.time?.() ?? simStart) - simStart;
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
      const done =
        elapsed() >= seconds ||
        (simStart !== null && now - start >= seconds * 4000);
      if (!done) requestAnimationFrame(step);
      else resolve({ samples, covered: Math.min(1, elapsed() / seconds) });
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
/** Median gap between upward zero crossings of the detrended series (s), or null. */
function crossingPeriod(times, values) {
  if (times.length < 20) return null;
  const v = detrend(times, values, 3);
  const crossings = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i - 1] < 0 && v[i] >= 0) {
      const f = v[i - 1] / (v[i - 1] - v[i]);
      crossings.push(times[i - 1] + (times[i] - times[i - 1]) * f);
    }
  }
  if (crossings.length < 4) return null;
  const gaps = crossings
    .slice(1)
    .map((t, k) => t - crossings[k])
    .sort((a, b) => a - b);
  const median = (g) => g[Math.floor(g.length / 2)];
  // A stalled frame hides one upward crossing and the two half-cycles merge
  // into a gap of roughly 2 T. The M4 window runs four 5 s screenshots
  // alongside the sampler, so a stall or two is normal, and the raw median
  // then drifts upward: a 2.1 s lantern has read 2.35 s this way, close
  // enough to its 2.4 s neighbour to look like a physics bug when the sim
  // is exact (ω = √(g'/L) with g' = 4π²L/T², so ω = 2π/T whatever the cord
  // length). Merged gaps are dropped; if too many of them are merged the
  // window is not worth a number, so null hands the row to the DFT.
  const clean = gaps.filter((g) => g < 1.5 * median(gaps));
  if (clean.length < 3 || clean.length < gaps.length * 0.6) return null;
  return median(clean);
}

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
/**
 * Letter columns on the drum: the equator row (inside the cap band) divided
 * by a row above the caps on the same drum. The ribs are meridians, so they
 * cancel in the ratio (each row is normalised by its own median first); the
 * shadow letters remain as dips ≥ 12% at least 0.03 × body wide (a cap stem
 * after the 2 px blur). Dips closer than a stem's width belong to one letter.
 */
function countLetterColumns(eqCols, upCols, dsf, bodyPx = 88) {
  const n = Math.min(eqCols.length, upCols.length);
  if (n < 8) return 0;
  const median = (a) => {
    const v = [...a].filter((x) => x > 0).sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length / 2)] : 1;
  };
  const mEq = median(eqCols);
  const mUp = median(upCols);
  const ratio = [];
  for (let i = 0; i < n; i++) {
    const up = upCols[i] / mUp;
    ratio.push(up > 0.05 ? eqCols[i] / mEq / up : 1);
  }
  const minRun = Math.max(2, Math.round(0.03 * bodyPx * dsf));
  const gap = Math.round(0.06 * bodyPx * dsf);
  const dips = [];
  let run = 0;
  for (let i = 0; i <= n; i++) {
    if (i < n && ratio[i] <= 0.88) run++;
    else {
      if (run >= minRun) dips.push({ start: i - run, end: i });
      run = 0;
    }
  }
  let count = 0;
  let lastEnd = -Infinity;
  for (const d of dips) {
    if (d.start - lastEnd > gap) count++;
    lastEnd = d.end;
  }
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
    const gustSampling = page
      .evaluate(sampleTheta, { seconds: 6.5 })
      .catch(() => null);

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
    // The θ sampler must finish before any mouse moves: a hover is cursor wind.
    const gust = await gustSampling;

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
    await guarded(id('M3'), () =>
      gustChecks({
        samples: gust?.samples ?? null,
        covered: gust?.covered ?? 0,
        layout,
        id,
        vp,
        route,
        live,
      }),
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
      if (route.key === 'blog') {
        await guarded(id('M8'), () => reducedMotionChecks({ page, ctx, id }));
        await guarded(id('refresh'), () => refreshChecks({ page, id }));
      }
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
    // --- Mobile /blog/[slug], reduced motion: the scroll-lift snaps (§3.4, §4.2)
    if (vp.mobile && route.key === 'blog-slug' && theme === 'dark') {
      await guarded(id('M8.reducedLift'), () =>
        reducedLiftChecks({ page, id }),
      );
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
  const slip = page
    .locator('[data-festival-root] button[aria-expanded]')
    .first();
  if (live.dom.slipButton) {
    await slip.hover();
    await page.waitForTimeout(900);
    await shot(page, `${tag}-slip-hover.png`);
    await page.keyboard.press('Escape');
    await page.mouse.move(5, 500);
  }
  if (live.dom.figure) {
    await page.locator('[data-festival-root] figure').first().focus();
    await page.waitForTimeout(400);
    await shot(page, `${tag}-poem-focus.png`);
    await page.locator('[data-festival-root] figure').first().blur();
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
      // Desktop bodies keep 24 px below the nav band (§7.4); the mobile
      // /blog table hangs 12 px under it by design (§3.3).
      const clearance =
        o.label.startsWith('nav') && f.label.includes('body')
          ? vp.mobile
            ? 12
            : 24
          : 0;
      if (intersects(f.rect, o.rect, clearance))
        hits.push(
          `${f.label} [${[f.rect.x, f.rect.y, f.rect.w, f.rect.h].map((v) => fmt(v, 0)).join(',')}] × ${o.label}`,
        );
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
  // §5.2: the fall passes beside the lanterns, never across the paper. No
  // instance with alpha > 0.1 sits inside a lantern body rect on this frame.
  const fallOnPaper = await page.evaluate(() => {
    const s = window.__festival?.state?.();
    const l = window.__festival?.layout?.();
    if (!s || !l) return null;
    const hits = [];
    for (const f of s.fall) {
      if (f.alpha <= 0.1) continue;
      for (const spec of l.lanterns) {
        const r = spec.bodyRect;
        if (f.x >= r.x && f.x <= r.x + r.w && f.y >= r.y && f.y <= r.y + r.h)
          hits.push(
            `${spec.id}:${f.species}@${Math.round(f.x)},${Math.round(f.y)} α${f.alpha.toFixed(2)}`,
          );
      }
    }
    return { hits, count: s.fall.length };
  });
  if (fallOnPaper && layout.lanterns.length)
    check(
      fallOnPaper.hits.length === 0,
      id('V8.fall'),
      'no fall instance (alpha > 0.1) inside a lantern body',
      fallOnPaper.hits.length
        ? fallOnPaper.hits.join('; ')
        : `${fallOnPaper.count} instances clear of ${layout.lanterns.length} bodies`,
      'none on the paper',
    );
  if (!vp.mobile) {
    // Only bodies horizontally under the nav band: the inset nav on
    // /past-experience and /schedule-a-call never covers the gutters (§3.5).
    const nav = obstacles.find((o) => o.label === 'nav')?.rect ?? null;
    const underNav = (l) =>
      !nav ||
      (l.bodyRect.x < nav.x + nav.w && l.bodyRect.x + l.bodyRect.w > nav.x);
    const bodyOk = layout.lanterns.every(
      (l) => !underNav(l) || l.bodyRect.y >= (layout.navBottom ?? 0) + 24 - 0.5,
    );
    check(
      bodyOk,
      id('V8.nav'),
      'lantern bodies under the nav band sit ≥ 24 px below it',
      layout.lanterns
        .map(
          (l) =>
            `${l.id}:${fmt(l.bodyRect.y - (layout.navBottom ?? 0), 0)}${underNav(l) ? '' : ' (gutter)'}`,
        )
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
  // A row above the cap band (caps span 31–69% of the paper height): the
  // same ribs, no letters; V6 reads the equator against it.
  const upperBand = { ...equator, y: hero.bodyRect.y + hero.bodyRect.h * 0.2 };
  const jobs = [
    { id: 'heroBody', rect: hero.bodyRect },
    { id: 'heroCore', rect: heroCore },
    { id: 'equator', rect: equator, cols: true },
    { id: 'upperBand', rect: upperBand, cols: true },
  ];
  // The ring around a lantern: the halo's 2.8× extent minus the lantern
  // itself (paper, collars, ring and tassel), so lit paper never reads as
  // glow. On `/` it is clipped to the free block (§3.1: x ≥ 1215, y 64–280)
  // so the monitor's white screen and the header stay out of it.
  const lanternHole = (body) => ({
    x: body.x - 4,
    y: body.y - body.w * 0.16,
    w: body.w + 8,
    h: body.h + body.w * 0.16 + body.w * 0.45,
  });
  const ringRect = (body, cordAnchorY = 0) => {
    const r = expandRect(body, HALO_WIDTH_FACTOR);
    // Nothing above the nav band or the cord anchor (the white nav surface,
    // /orbital's tools pill): those are page, not glow.
    const free = isHome
      ? { x: 1215 + (vp.width - 1440), y: 64, w: 225, h: 216 }
      : {
          x: 0,
          y: Math.max(layout.navBottom ?? 0, cordAnchorY),
          w: vp.width,
          h: vp.height,
        };
    const x0 = Math.max(r.x, free.x);
    const y0 = Math.max(r.y, free.y);
    const x1 = Math.min(r.x + r.w, free.x + free.w);
    const y1 = Math.min(r.y + r.h, free.y + free.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const haloRing = ringRect(hero.bodyRect, hero.cordAnchorY);
  jobs.push({
    id: 'haloRing',
    rect: haloRing,
    hole: lanternHole(hero.bodyRect),
  });
  for (const l of layout.lanterns) {
    jobs.push({
      id: `lantern:${l.id}`,
      rect: ringRect(l.bodyRect, l.cordAnchorY),
      hole: lanternHole(l.bodyRect),
    });
  }
  const moon = moonRect(layout.moon);
  if (moon) jobs.push({ id: 'moon', rect: moon });
  const pool = poolRect(hero.bodyRect);
  // V2 samples the WALL, never the lantern: 12 px under the tassel's tip on
  // the hero's axis (the ellipse's core), and 40 px beside the body at collar
  // height on the side away from lantern B / toward the copy column. The
  // old probe (the pool's geometric centre) landed inside the paper body and
  // read the lit paper as "pool visible".
  const body = hero.bodyRect;
  const poolCentre = {
    x: body.x + body.w / 2 - 6,
    y: body.y + body.h + body.w * TASSEL_DROP_FACTOR + 12 - 6,
    w: 12,
    h: 12,
  };
  const poolSide = {
    x: (isHome ? body.x - 40 : body.x + body.w + 40) - 6,
    y: body.y + body.h - 6,
    w: 12,
    h: 12,
  };
  jobs.push({ id: 'poolCentre', rect: poolCentre });
  jobs.push({ id: 'poolSide', rect: poolSide });
  // Copy-column edge nearest the hero, from the layout's exclusion rects.
  const column = columnEdge(layout, hero, vp);
  if (column)
    jobs.push({
      id: 'columnEdge',
      rect: { x: column.x, y: pool.y, w: 4, h: pool.h },
      // V2 budgets the pool; a lantern hung flush against the column (§3.5
      // B at x176) spills its 2.8× halo over the edge by design.
      holes: [
        ...layout.lanterns.map((l) =>
          expandRect(l.bodyRect, HALO_WIDTH_FACTOR),
        ),
        ...(layout.textExclusions ?? []),
      ],
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
    // 16 ribs around the drum; the camera sees the front 8 (the bible's
    // "≥ 12" counted the back half too).
    const minima = countMinima(s.equator.cols, 0.2);
    check(
      minima >= 6,
      id('V1.ribs'),
      '≥ 6 of the 8 front-facing rib minima along the equator (each ≥ 20% below neighbours)',
      minima,
      '≥ 6',
      `2× crop ${equator.w * vp.dsf} px wide`,
    );
  }

  // V2 pool visible beside the H1 and < 0.02 at the column edge.
  if (lit && P) {
    const poolTint = hexRgb(P.paperMid);
    const centreAlpha = alphaEstimate(s.poolCentre.meanRgb, setBg, poolTint);
    const sideAlpha = alphaEstimate(s.poolSide.meanRgb, setBg, poolTint);
    // The edge is read against the strip's own darkest rows: the page along
    // a column edge is not `--background` (the inset nav / cards lift it by
    // ≈ 6 levels), and that offset alone read as α 0.03 of pool.
    const edgeAlpha =
      column && s.columnEdge
        ? alphaEstimate(
            s.columnEdge.meanRgb,
            isHome ? setBg : s.columnEdge.darkDecileRgb,
            poolTint,
          )
        : null;
    check(
      centreAlpha !== null && centreAlpha >= 0.06,
      id('V2.poolVisible'),
      'pool visible on the wall 12 px under the tassel',
      `α≈${fmt(centreAlpha, 3)} at (${fmt(poolCentre.x + 6, 0)},${fmt(poolCentre.y + 6, 0)})`,
      '≥ 0.06 (peak 0.14 / 0.22 on /)',
      'sampled on the page, outside the lantern',
    );
    check(
      sideAlpha !== null && sideAlpha >= 0.015,
      id('V2.poolSide'),
      'pool reaches the wall 40 px beside the body at collar height',
      `α≈${fmt(sideAlpha, 3)} at (${fmt(poolSide.x + 6, 0)},${fmt(poolSide.y + 6, 0)})`,
      '≥ 0.015 (r ≈ 0.62 on the ellipse: (1 − r)² × 0.14)',
    );
    if (edgeAlpha !== null)
      check(
        edgeAlpha < 0.02 + 0.01,
        id('V2.poolEdge'),
        'pool alpha < 0.02 at the copy-column edge',
        `α≈${fmt(edgeAlpha, 3)} at x${fmt(column.x, 0)}`,
        '< 0.02 (+0.01 noise)',
        "against the strip's darkest decile (the local page)",
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
    // The core, not the body rect: the rect's corners are page background.
    const got = s.heroCore.brightDecileRgb;
    const delta = Math.max(...got.map((v, i) => Math.abs(v - cream[i])));
    check(
      delta <= 6,
      id('V4.cream'),
      'unlit paper #e9dcc4 ± 6 (brightest decile)',
      `rgb(${got}) Δ${delta}`,
      `rgb(${cream}) ± 6`,
    );
    // Bright-decile luminance of the ring (a single pixel would be a floret).
    const ringY = luminance(s.haloRing.brightDecileRgb);
    const ringGlow = ringY - luminance(bg);
    check(
      ringY <= Math.max(luminance(bg), luminance(cream)) + 0.02,
      id('V4.noGlow'),
      'no glow around the lantern in light',
      `ring p90 Y ${fmt(ringY, 3)} (bg ${fmt(luminance(bg), 3)})`,
      '≤ max(bg, cream) + 0.02',
      `Δ ${fmt(ringGlow, 3)}`,
    );
    if (moon) {
      // The layer's own day/night blend when exposed (the pixel estimate
      // reads any page pixel brighter than --background, e.g. a gradient).
      const apiNight = live.moonNight;
      const moonAlpha =
        typeof apiNight === 'number'
          ? 0.07 + 0.93 * apiNight
          : (s.moon.maxY - luminance(bg)) /
            Math.max(1e-6, luminance(hexRgb(P.moonBody)) - luminance(bg));
      check(
        moonAlpha <= 0.1,
        id('V4.moon'),
        'daytime moon ≤ 8% alpha',
        `α≈${fmt(moonAlpha, 3)}${typeof apiNight === 'number' ? ' (moon().night)' : ' (pixels)'}`,
        '≤ 0.08 (+0.02)',
      );
    }
  }

  // V5 `/`: no additive halo; warm pool; nothing below y330 or in the H1 block.
  if (isHome) {
    const grey = luminance(setBg);
    const ringY = luminance(s.haloRing.brightDecileRgb);
    check(
      ringY <= grey + 0.03,
      id('V5.noHalo'),
      'no additive halo on the grey set',
      `ring p90 Y ${fmt(ringY, 3)} vs set ${fmt(grey, 3)}`,
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
      const r = await analyze(b64, [
        { id: 'eq', rect: equator, cols: true },
        { id: 'up', rect: upperBand, cols: true },
      ]);
      best = Math.max(
        best,
        countLetterColumns(r.eq.cols, r.up.cols, vp.dsf, hero.body),
      );
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
    // The lamp is physical: the brightest paper pixel (mix(paperMid,
    // paperCore, 0.55·candle) by the §2.2 shader) is the same under every
    // colour theme, and warm (R > G > B, above paperMid's green).
    const got = s.heroCore.maxRgb;
    const mid = hexRgb(P.paperMid);
    const reference = v7Lamp.get(route.key);
    if (colour === 'mono') v7Lamp.set(route.key, got);
    const delta = reference
      ? Math.max(...got.map((v, i) => Math.abs(v - reference[i])))
      : 0;
    check(
      delta <= 4 && got[0] >= got[1] && got[1] >= got[2] && got[1] >= mid[1],
      id('V7.lamp'),
      `lamp stays warm under ${colour}`,
      `brightest rgb(${got})${reference ? ` Δ${delta} vs mono rgb(${reference})` : ''}`,
      'same as mono ± 4, R ≥ G ≥ B',
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
/** Brightest hero-core pixel per route under mono, for V7. */
const v7Lamp = new Map();

// ---------------------------------------------------------------------------
// M3 first gust: arrival per lantern, peak order and spacing
// ---------------------------------------------------------------------------

function gustChecks({ samples, covered, layout, id, vp, route }) {
  if (!samples || !samples.some((s) => s.theta)) {
    skip(
      id('M3'),
      'first-gust arrival timings',
      '__festival.theta() unavailable during 2.6–9 s',
    );
    return;
  }
  if (covered < 0.8) {
    skip(
      id('M3'),
      'first-gust arrival timings',
      `SwiftShader ran only ${fmt(covered * 100, 0)}% of the 6.5 s sim window in 26 s wall; GPU pass`,
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
    const after = series.filter((p) => p.t >= FIRST_GUST_S - 0.05);
    const peak = after.reduce(
      (a, b) => (Math.abs(b.v) > Math.abs(a.v) ? b : a),
      { t: null, v: 0 },
    );
    // Arrival = onset: the first frame after the front leaves where θ has
    // moved > 0.15° from its pre-gust value (the pendulum answers within
    // ≈ 0.2 s of the front; the 25%-of-peak point is ≈ 0.6 s later).
    const preValue = series
      .filter((p) => p.t <= FIRST_GUST_S && p.t > 0)
      .at(-1);
    const arrival =
      (preValue &&
        after.find(
          (p) => p.t > FIRST_GUST_S && Math.abs(deg(p.v - preValue.v)) > 0.15,
        )?.t) ??
      null;
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
  const arrivalOk = ordered.every((i) => {
    if (arrivals[i] === null) return false;
    const lead = arrivals[i] - expectedArrival(layout.lanterns[i].x);
    return (
      lead >= -GUST_TOLERANCE_MS / 1000 &&
      lead <= GUST_RESPONSE_S + GUST_TOLERANCE_MS / 1000
    );
  });
  check(
    arrivalOk,
    id('M3.arrival'),
    'first gust reaches each lantern at 4.4 + (x + 0.1vw)/(0.55vw/s) ± 120 ms (θ onset ≤ 0.2 s after the front)',
    rows.join(' | '),
    '−0.12 … +0.32 s',
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
  // M5's tassel row, measured where the bible defines it: at the first-gust
  // peak of the hero, from the ABSOLUTE tassel angle (θ + tasselTheta). The
  // strands hang from the collar and restore toward plumb: at the onset they
  // trail the collar, then whip through plumb and peak past the body 50–150
  // ms after the body's own peak (§2.2, §4.5).
  const heroIndex = Math.max(
    0,
    layout.lanterns.findIndex((l) => l.hero),
  );
  const withTassel = samples.filter(
    (s) => s.theta && s.tassel && s.theta.length > heroIndex,
  );
  if (vp.mobile) {
    skip(
      id('M5.tassel'),
      'tassel whip lags body 50–150 ms',
      'M5 is a desktop row (no pointer on phones)',
    );
  } else if (withTassel.length > 20) {
    // Peak times as centroids of the samples within 2% of the maximum: the
    // sim steps 33 ms at the clamp and both peaks are flat-topped, so a
    // single-sample argmax is ± a step either way.
    const valueOf = (s, key) =>
      key === 'abs'
        ? s.theta[heroIndex] + s.tassel[heroIndex]
        : s[key][heroIndex];
    const centroid = (key, from, to) => {
      let max = 0;
      for (const s of withTassel) {
        const t = time(s);
        if (t >= from && t <= to)
          max = Math.max(max, Math.abs(valueOf(s, key)));
      }
      if (max < 0.01) return null;
      let sum = 0;
      let n = 0;
      for (const s of withTassel) {
        const t = time(s);
        if (t >= from && t <= to && Math.abs(valueOf(s, key)) >= 0.98 * max) {
          sum += t;
          n++;
        }
      }
      return { t: sum / n, v: max };
    };
    // The gust peak: the largest |θ| after the front (the breeze ripples
    // before it are local maxima too); the tassel's whip within half its
    // period after that.
    const body = centroid('theta', FIRST_GUST_S + 0.2, Infinity);
    const whip = body && centroid('abs', body.t, body.t + 0.5);
    const lag = body && whip ? (whip.t - body.t) * 1000 : null;
    check(
      lag !== null &&
        lag >= 50 - 33 &&
        lag <= 150 + 33 &&
        whip.v >= 0.9 * body.v,
      id('M5.tassel'),
      'tassel whips past the hero body 50–150 ms after the body peak at the first gust (absolute angle)',
      lag === null
        ? 'no peak pair'
        : `${fmt(lag, 0)} ms, whip ${fmt((100 * whip.v) / body.v, 0)}% of the body peak`,
      '50–150 ms ± one 33 ms sim step; whip ≥ 90% of the body peak',
      'peak centroids; frame-quantised on SwiftShader',
    );
  } else
    skip(
      id('M5.tassel'),
      'tassel whip lags body 50–150 ms',
      '__festival.tassel() not exposed',
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
  const sampling = page.evaluate(sampleTheta, { seconds: 20 });
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
  const { samples, covered } = await sampling;
  if (covered < 0.5) {
    skip(
      id('M4'),
      'pendulum periods (20 s θ sampling)',
      `SwiftShader ran only ${fmt(covered * 100, 0)}% of the 20 s sim window in 80 s wall; GPU pass`,
    );
    return;
  }
  const useSim = samples.every((s) => typeof s.sim === 'number');
  const time = (s) => (useSim ? s.sim : s.wall);
  const periods = layout.lanterns.map((l, i) => {
    const pts = samples.filter((s) => s.theta && s.theta.length > i);
    const times = pts.map(time);
    const values = pts.map((s) => s.theta[i]);
    return {
      id: l.id,
      expected: l.period,
      // Upward zero-crossing gaps of the detrended series (median) resolve
      // the period far better than a DFT over a 20 s window; the DFT is the
      // fallback when the swing is too small to cross.
      got: crossingPeriod(times, values) ?? dominantPeriod(times, values),
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
          {
            id: 'up',
            rect: {
              x: 2,
              y: layout.lanterns.find((l) => l.hero).bodyRect.h * 0.2,
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
      best = Math.max(
        best,
        countLetterColumns(r.eq.cols, r.up.cols, 2, v6.hero),
      );
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
  const sampling = page.evaluate(sampleTheta, { seconds: 3, useSim: false });
  await page.evaluate(sweepPointer, {
    x0,
    x1,
    y,
    ms: (span / SWEEP_PX_PER_S) * 1000,
  });
  const { samples } = await sampling;
  const simmed = samples.filter((s) => typeof s.sim === 'number');
  const simRate =
    simmed.length > 2
      ? (simmed.at(-1).sim - simmed[0].sim) /
        Math.max(1e-6, simmed.at(-1).wall - simmed[0].wall)
      : 1;
  if (simRate < 0.8) {
    skip(
      id('M5.nearest'),
      'sweep at 1200 px/s deflects the hero ≥ 5°',
      `sim ran at ${fmt(simRate, 2)}× wall on SwiftShader: a wall-timed sweep is a shorter push; run with --gpu`,
    );
    skip(id('M5.farthest'), 'farthest lantern ≤ 3°', 'GPU pass');
    skip(id('M5.poem'), 'poem column leans ≤ 0.6°', 'GPU pass');
    skip(
      id('M5.noAttraction'),
      'no attraction from a still pointer',
      'needs a human eye pass; force ∝ velocity is a code-review item',
    );
    await page.waitForTimeout(2500);
    return;
  }
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
  // §7.7 M5: the sweep passes through the hero's centre and stops 504 px
  // past it (the 0.35 vw falloff radius), a 0.45 s push on a 2.8 s
  // pendulum: ≈ 0.47 of the static lean, 5.6° measured (the lighter
  // lantern it passes, pushed longer, reaches ≥ 8°).
  check(
    maxDeg[nearest] >= 5,
    id('M5.nearest'),
    'sweep at 1200 px/s deflects the hero ≥ 5°',
    `${layout.lanterns[nearest].id} ${fmt(maxDeg[nearest], 1)}°`,
    '≥ 5°',
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
  if (
    after.anchor.x === before.anchor.x &&
    after.anchor.y === before.anchor.y
  ) {
    skip(
      id('resize.moon'),
      'same-set resize re-anchors the moon',
      'left-anchored moon: the anchor does not move with the width',
    );
    return;
  }
  const dx = after.centre ? after.centre.x - after.anchor.x : NaN;
  const dy = after.centre ? after.centre.y - after.anchor.y : NaN;
  check(
    Math.abs(dx) <= 1 && Math.abs(dy) <= 1,
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
    let link = page.locator('a[href="/past-experience"]:visible').first();
    if ((await link.count()) === 0) {
      // Mobile: the link lives in the hamburger menu.
      const menu = page.locator('button[aria-label="Open menu"]').first();
      if ((await menu.count()) > 0) {
        await menu.click();
        await page.waitForTimeout(300);
        link = page.locator('a[href="/past-experience"]:visible').first();
      }
    }
    if ((await link.count()) === 0) {
      fail(
        id('M6'),
        'route change',
        'no visible <a href="/past-experience"> on /blog',
        '',
        '',
      );
      return;
    }
    // Sim time: the exit/enter rows run on the sim clock and the browser
    // stalls rAF while it commits the new page (SwiftShader: several samples
    // would otherwise land in one frame).
    const tClick = await page.evaluate(() => window.__gauntlet.now());
    await link.evaluate((a) => a.click());
    const sinceClick = (ms) =>
      page.waitForFunction(
        (args) => window.__gauntlet.now() - args.t >= args.ms,
        { t: tClick, ms },
        { polling: 8, timeout: 60000 },
      );
    // Mid-exit capture (§7.7: 140 ms after the navigation).
    await sinceClick(140);
    await page.screenshot({ path: join(OUT, `${tag}-mid-exit.png`) });
    // Moon glide: three samples inside the 600 ms glide, each with the live
    // nav band, which the disc must never enter (§4.2).
    const moonSamples = [];
    for (const ms of [250, 400, 550]) {
      await sinceClick(ms);
      moonSamples.push(
        await page.evaluate(() => {
          const nav = document
            .querySelector('header.sticky')
            ?.getBoundingClientRect();
          const root =
            document.querySelector('[data-festival-root]') ??
            document.documentElement;
          const num = (name) => {
            const v = getComputedStyle(root).getPropertyValue(name).trim();
            return v ? parseFloat(v) : null;
          };
          return {
            x: num('--moon-x'),
            y: num('--moon-y'),
            d: num('--moon-d'),
            path: location.pathname,
            nav: nav
              ? { x: nav.left, y: nav.top, w: nav.width, h: nav.height }
              : null,
          };
        }),
      );
    }
    if (!vp.mobile) {
      const bites = moonSamples
        .filter((m) => m.x !== null && m.nav && m.path === '/past-experience')
        .filter((m) => {
          const r = m.d / 2;
          return intersects({ x: m.x - r, y: m.y - r, w: m.d, h: m.d }, m.nav);
        })
        .map((m) => `disc (${fmt(m.x, 0)},${fmt(m.y, 0)}) d${fmt(m.d, 0)}`);
      check(
        bites.length === 0,
        id('M6.moonNav'),
        "the gliding disc never enters the new page's nav band",
        bites.length
          ? bites.join('; ')
          : `${moonSamples.filter((m) => m.path === '/past-experience').length} samples on the new page clear`,
        'no intersection',
      );
    }
    // The exit can only start when the new pathname commits (Next fetches
    // the route first: dev-server latency); measure from that commit.
    const nav = await page.evaluate(() => {
      const g = window.__gauntlet;
      const sim = g.sim.nav;
      return typeof sim === 'number' ? sim * 1000 : g.t.nav;
    });
    const tNav = typeof nav === 'number' ? nav : tClick;
    const exitStart = await page.evaluate(() => {
      const g = window.__gauntlet;
      const sim = g.sim['text:exit'];
      return typeof sim === 'number' ? sim * 1000 : g.t['text:exit'];
    });
    check(
      exitStart !== undefined && exitStart - tNav <= 200,
      id('M6.textExit'),
      'text exit starts ≤ 200 ms after the navigation commits',
      exitStart === undefined
        ? 'data-text="exit" never set'
        : `${fmt(exitStart - tNav, 0)} ms (commit ${fmt(tNav - tClick, 0)} ms after the click)`,
      '≤ 200 ms',
      'sim time',
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
    // Exit 280 ms + enter ≈ 1.0 s to lit (§4.2) from the commit: judge the
    // new lockup 1.7 s after it (300 ms of slack for the catch keyframes).
    await sinceClick(tNav - tClick + 1700);
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
    if (after.state && layout && layout.florets.count === 0)
      skip(
        id('M6.florets'),
        'floret count > 0 in every frame',
        'the target layout has no florets (mobile /past-experience is off by design)',
      );
    else if (after.state)
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
  // Sim time (the wick keyframes run on the sim clock; SwiftShader is slow).
  const t0 = await page.evaluate(() => window.__gauntlet.now());
  const since = (ms) =>
    page.waitForFunction(
      (a) => window.__gauntlet.now() - a.t >= a.ms,
      { t: t0, ms },
      { polling: 16, timeout: 60000 },
    );
  await page.evaluate(setTheme, 'dark');
  await since(350);
  await page.screenshot({
    path: join(OUT, `${tag}-theme-mid-catch-350ms.png`),
  });
  // 120 + 90·2 + 700 = 1000 ms for the third lantern; 100 ms of frame slack.
  await since(1100);
  const w1 = await warmth(`${tag}-theme-dusk-1s.png`);
  check(
    w0 < 60 && w1 > 100,
    id('M7.dusk'),
    'candle catch done within 1.1 s of light → dark',
    `warmth ${fmt(w0, 0)} → ${fmt(w1, 0)}`,
    'unlit < 60 → lit > 100',
  );
  const t1 = await page.evaluate(() => window.__gauntlet.now());
  await page.evaluate(setTheme, 'light');
  await page.waitForFunction(
    (a) => window.__gauntlet.now() - a.t >= a.ms,
    { t: t1, ms: 300 },
    { polling: 16, timeout: 60000 },
  );
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

/**
 * Reduced motion on the mobile post: no loop runs, so the §3.3 scroll-lift
 * must arrive as a snap from the scroll listener (the lantern would otherwise
 * stay painted over the article, V10).
 */
async function reducedLiftChecks({ page, id }) {
  const lantern = () =>
    page.evaluate(() => {
      try {
        const l = window.__festival?.state?.()?.lanterns?.[0];
        return l
          ? { lit: l.lit, rise: l.rise, alpha: l.alpha, y: window.scrollY }
          : null;
      } catch {
        return null;
      }
    });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  const before = await lantern();
  if (!before) {
    skip(id('M8.reducedLift'), 'reduced scroll-lift', 'state() not exposed');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    return;
  }
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  const lifted = await lantern();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const back = await lantern();
  check(
    lifted.alpha === 0 && lifted.rise > 0 && lifted.lit === 0,
    id('M8.reducedLift'),
    'reduced motion: the mobile lantern lifts and fades past scrollY 120 (snap)',
    `scrollY ${lifted.y}: lit ${fmt(lifted.lit, 2)} rise ${fmt(lifted.rise, 0)} alpha ${fmt(lifted.alpha, 2)}`,
    'alpha 0, rise 24, lit 0',
  );
  check(
    back.alpha === 1 && back.rise === 0,
    id('M8.reducedReturn'),
    'reduced motion: the lantern is back at rest below scrollY 40',
    `scrollY ${back.y}: rise ${fmt(back.rise, 0)} alpha ${fmt(back.alpha, 2)}`,
    'alpha 1, rise 0',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(300);
}

/**
 * A root-layout re-render with a fresh `posts` payload (router.refresh) must
 * not rebuild the WebGL runtime: the frame counter keeps counting, the
 * settled flag stays, and no second renderer initialises on the context.
 */
async function refreshChecks({ page, id }) {
  const hasRouter = await page.evaluate(
    () => typeof window.next?.router?.refresh === 'function',
  );
  if (!hasRouter) {
    skip(
      id('refresh.runtime'),
      'router.refresh() keeps the runtime',
      'window.next.router not exposed in this build',
    );
    return;
  }
  const warnings = [];
  const onConsole = (m) => {
    if (/texImage3D|WebGL: INVALID/i.test(m.text())) warnings.push(m.text());
  };
  page.on('console', onConsole);
  const before = await page.evaluate(() => ({
    frames: window.__festival?.frames?.() ?? null,
    settled: document.documentElement.getAttribute('data-festival-settled'),
  }));
  await page.evaluate(() => window.next.router.refresh());
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    frames: window.__festival?.frames?.() ?? null,
    settled: document.documentElement.getAttribute('data-festival-settled'),
  }));
  page.off('console', onConsole);
  check(
    before.frames !== null &&
      after.frames > before.frames &&
      after.settled === 'true' &&
      warnings.length === 0,
    id('refresh.runtime'),
    'router.refresh() keeps the runtime: frames continue, settled stays, no GL warnings',
    `frames ${before.frames} → ${after.frames}, settled ${before.settled} → ${after.settled}, warnings ${warnings.length}`,
    'frames increase, settled true, 0 warnings',
  );
}

/**
 * The moon's own day/night blend follows the route: `/` pins night = 1, so
 * arriving on a moon route in the light theme must retarget it to 0 (a full
 * night moon beside unlit lanterns otherwise, V4).
 */
async function moonNightRun({ browser }) {
  const ctx = await newContext(browser, VIEWPORTS.desktop, 'light');
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  try {
    await page.goto(festivalUrl(BASE_URL, '/'), { waitUntil: 'load' });
    if (!(await waitForLayer(page))) {
      fail(
        'V4.moonNightRoute',
        'moon night after / → /orbital',
        'layer missing on /',
        '',
        '',
      );
      return;
    }
    await waitSettled(page);
    const link = page.locator('a[href="/orbital"]').first();
    if ((await link.count()) === 0) {
      skip(
        'V4.moonNightRoute',
        'moon night after / → /orbital',
        'no <a href="/orbital"> on /',
      );
      return;
    }
    await link.evaluate((a) => a.click());
    await page
      .waitForFunction(() => location.pathname === '/orbital', null, {
        timeout: 20000,
      })
      .catch(() => {});
    await waitSettled(page);
    const moon = await page.evaluate(() => {
      try {
        return window.__festival?.moon?.() ?? null;
      } catch {
        return null;
      }
    });
    check(
      moon !== null && moon.night < 0.1,
      'V4.moonNightRoute',
      'light theme, / → /orbital: the moon arrives as the 7% daytime disc (night < 0.1)',
      moon
        ? `night ${fmt(moon.night, 2)} alpha ${fmt(moon.alpha, 2)}`
        : 'moon() absent',
      'night < 0.1',
    );
    await shot(page, 'orbital-light-after-home.png');
  } finally {
    await ctx.close();
  }
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
  // The dim is an alpha over the page, applied to sRGB-encoded values (as
  // CSS opacity is), so it is measured on the encoded green channel.
  const moonG = async (name) => {
    const b64 = (await page.screenshot({ path: join(OUT, name) })).toString(
      'base64',
    );
    const r = await lab.evaluate(analyzePng, {
      b64,
      dsf: vp.dsf,
      jobs: [{ id: 'm', rect: moon }],
    });
    return r.m.brightDecileRgb[1];
  };
  const rest = await moonG(`${tag}-scroll-0.png`);
  await page.mouse.move(720, 600);
  await page.mouse.wheel(0, 520);
  await page.waitForFunction(
    () => window.scrollY > 400 && (window.__festival?.time?.() ?? 0) > 0,
    null,
    { timeout: 10000 },
  );
  const t0 = await page.evaluate(() => window.__gauntlet.now());
  await page.waitForFunction((a) => window.__gauntlet.now() - a >= 900, t0, {
    polling: 16,
    timeout: 60000,
  });
  const scrolled = await moonG(`${tag}-scroll-520.png`);
  const ratio = (scrolled - bg[1]) / Math.max(1e-6, rest - bg[1]);
  check(
    Math.abs(ratio - 0.6) <= 0.12,
    id('M9.moonDim'),
    'moon at 60% past scrollY 400',
    `encoded ratio ${fmt(ratio, 2)} (bright decile G ${rest} → ${scrolled})`,
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
  const back = await moonG(`${tag}-scroll-back.png`);
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
    // The seven Han glyphs; the `/` mono label is a glyph span too but not a date glyph.
    const colophonGlyphs = colophon
      ? [...colophon.querySelectorAll('[lang^="zh"] [class*="glyph"]')].map(
          (g) => g.getBoundingClientRect(),
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
            owner: (() => {
              const el = n.parentElement.closest(
                'figure, [class*="colophon"], [class*="slip"], [class*="moon"], [class*="caption"]',
              );
              if (!el) return 'loose';
              const cls = String(el.className);
              for (const k of ['caption', 'colophon', 'slip', 'moon']) {
                if (cls.includes(k)) return k;
              }
              return el.tagName.toLowerCase();
            })(),
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
      colophonLabelOpacity: (() => {
        const label = q('[class*="colophonLabel"]')[0] ?? null;
        return label ? parseFloat(cs(label).opacity) : null;
      })(),
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
      // :focus-visible follows the input modality: a real Tab puts the page
      // in keyboard mode, and a script focus after it keeps the ring.
      await page.keyboard.press('Tab');
      await page.evaluate(() =>
        document.querySelector('[data-festival-root] figure')?.focus(),
      );
      await page.waitForTimeout(350); // the 200 ms opacity transition
      const focused = await page.evaluate(() => {
        const p = document.querySelector('[class*="pinyin"]');
        const s = getComputedStyle(p);
        return s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.5;
      });
      await page.locator('[data-festival-root] figure').first().blur();
      check(
        !census.pinyinVisibleIdle && focused,
        id('T3.pinyin'),
        'pinyin only on focus',
        `idle ${census.pinyinVisibleIdle ? 'visible' : 'hidden'}, focused ${focused ? 'visible' : 'hidden'}`,
        'hidden → visible',
      );
    }
  }
  if (census.colophonLabelOpacity !== null)
    check(
      Math.abs(census.colophonLabelOpacity - 0.72) <= 0.02,
      id('T6.colophonLabel'),
      'THE FIFTEENTH NIGHT sits at 72% under the Han date (§6.A1)',
      fmt(census.colophonLabelOpacity, 2),
      '0.72',
    );
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
    // Without a <main> (past-experience, schedule-a-call) DOM order after
    // the page content is what the root layout guarantees; nothing to test.
    const after = (el) =>
      !!el &&
      (!main ||
        !!(
          main.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
        ));
    const slip = root?.querySelector('button[aria-expanded]') ?? null;
    const moon = root?.querySelector('button[aria-label^="Full moon"]') ?? null;
    const name = (el) =>
      el?.getAttribute('aria-label') || el?.textContent.trim() || '';
    const cs = (el) => getComputedStyle(el);
    const parse = (c) => {
      const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      // `color-mix()` computes to `color(srgb r g b / a)` with 0..1 channels.
      if (/^color\(srgb/.test(c))
        return {
          rgb: m.slice(0, 3).map((v) => Math.round(v * 255)),
          a: m[3] ?? 1,
        };
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
      // The slip opens on FOCUS by design (RiddleSlip `onFocus → openAs
      // ('focus')`), so the sequence a keyboard user actually walks is
      // focus → open, Enter → closed, Enter → open, Escape → closed with
      // focus back on the strip. The old probe pressed Enter before reading
      // the first state, which put the whole expectation off by one and
      // failed a slip that behaves exactly as specified.
      const expanded = () =>
        page.evaluate(() =>
          document
            .querySelector('[data-festival-root] button[aria-expanded]')
            ?.getAttribute('aria-expanded'),
        );
      await page
        .locator('[data-festival-root] button[aria-expanded]')
        .first()
        .focus();
      await page.waitForTimeout(250);
      const onFocus = await expanded();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      const toggledOff = await expanded();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      const toggledOn = await expanded();
      check(
        onFocus === 'true' && toggledOff === 'false' && toggledOn === 'true',
        id('A.toggle'),
        'focus opens the slip; Enter folds it; Enter again unfolds it',
        `focus=${onFocus} → ${toggledOff} → ${toggledOn}`,
        'true → false → true',
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const afterEsc = await page.evaluate(() => {
        const b = document.querySelector(
          '[data-festival-root] button[aria-expanded]',
        );
        return {
          expanded: b?.getAttribute('aria-expanded'),
          onPull: document.activeElement === b,
        };
      });
      check(
        toggledOn === 'true' &&
          afterEsc.expanded === 'false' &&
          afterEsc.onPull,
        id('A.escape'),
        'Escape closes the open slip and leaves focus on the strip',
        `open=${toggledOn} closed=${afterEsc.expanded} focus on strip=${afterEsc.onPull}`,
        'true → false, strip focused',
      );
      // Escape from the 谜底 link returns focus to the strip button (the
      // disclosure's trigger) without re-opening it.
      const pull = page
        .locator('[data-festival-root] button[aria-expanded]')
        .first();
      await pull.focus();
      await page.waitForTimeout(300);
      await page
        .locator('[data-festival-root] [class*="answerLink"]')
        .first()
        .focus();
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const afterEscape = await page.evaluate(() => {
        const b = document.querySelector(
          '[data-festival-root] button[aria-expanded]',
        );
        return {
          onPull: document.activeElement === b,
          expanded: b?.getAttribute('aria-expanded'),
          controls: !!b?.getAttribute('aria-controls'),
        };
      });
      check(
        afterEscape.onPull &&
          afterEscape.expanded === 'false' &&
          afterEscape.controls,
        id('A.escapeFocus'),
        'Escape from the 谜底 link returns focus to the strip, closed',
        `active on strip=${afterEscape.onPull} expanded=${afterEscape.expanded} aria-controls=${afterEscape.controls}`,
        'strip focused, aria-expanded false, aria-controls set',
      );
      await pull.blur();
      await page.mouse.move(5, 500);
      await page.waitForTimeout(400);
      // Hover intent: a straight diagonal from the strip's centre to the
      // 谜底 link leaves the strip over bare page before it enters the card;
      // the card must stay open across it and the link must take the hover.
      const stripRect = live.dom.slipButton;
      if (stripRect) {
        await page.mouse.move(
          stripRect.x + stripRect.w / 2,
          stripRect.y + stripRect.h / 2,
        );
        await page.waitForTimeout(900);
        const linkCentre = await page.evaluate(() => {
          const a = document.querySelector(
            '[data-festival-root] [class*="answerLink"]',
          );
          const r = a?.getBoundingClientRect();
          return r
            ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
            : null;
        });
        if (linkCentre) {
          // A slow hand: twenty steps (≈ 65 ms each on SwiftShader, 1.3 s
          // end to end, well past the 400 ms grace) so the walk is carried
          // by the hover bridge, not by the timer.
          const x0 = stripRect.x + stripRect.w / 2;
          const y0 = stripRect.y + stripRect.h / 2;
          for (let i = 1; i <= 20; i += 1) {
            await page.mouse.move(
              x0 + ((linkCentre.x - x0) * i) / 20,
              y0 + ((linkCentre.y - y0) * i) / 20,
            );
          }
          await page.waitForTimeout(150);
          const diagonal = await page.evaluate(() => ({
            expanded: document
              .querySelector('[data-festival-root] button[aria-expanded]')
              ?.getAttribute('aria-expanded'),
            linkHover: !!document.querySelector(
              '[data-festival-root] [class*="answerLink"]:hover',
            ),
          }));
          check(
            diagonal.expanded === 'true' && diagonal.linkHover,
            id('A.hoverIntent'),
            'a diagonal from the strip to the 谜底 link keeps the card open and reaches the link',
            `expanded=${diagonal.expanded} link:hover=${diagonal.linkHover}`,
            'true / true',
          );
        }
        await page.mouse.move(5, 500);
        await page.waitForTimeout(500);
      }
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
    // Focus rings on the moon button and the poem figure: page-side ink,
    // ≥ 3:1 against the page in both themes (WCAG 2.4.11).
    //
    // Two things make this probe delicate, and the old one got both wrong:
    // `getComputedStyle` hands back a LIVE declaration, so reading
    // `outlineStyle` after `el.blur()` read the unfocused value ('none') and
    // every row failed with "no outline while focused"; and :focus-visible
    // follows the input modality, so blurring back to <body> drops the
    // keyboard modality and the next scripted `.focus()` draws no ring
    // either. Each element is therefore probed on its own: a real key press
    // first, then `focus({ focusVisible: true })` (ignored by engines that
    // do not support the option — the key press already covers them), then
    // every value snapshotted before anything else touches focus. Nothing
    // is blurred; moving to the next element is the only focus change.
    const ringOf = async (which) => {
      await page.keyboard.press('Tab');
      return page.evaluate((which) => {
        const root = document.querySelector('[data-festival-root]');
        const el =
          which === 'moon'
            ? root?.querySelector('button[aria-label^="Full moon"]')
            : root?.querySelector('figure');
        const target =
          which === 'moon' ? el : el?.querySelector('[class*="column"]');
        if (!el || !target) return null;
        el.focus({ focusVisible: true });
        const s = getComputedStyle(target);
        // Snapshot while the element still holds focus.
        const style = s.outlineStyle;
        const width = parseFloat(s.outlineWidth);
        const raw = s.outlineColor;
        const m =
          raw
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map(Number) ?? null;
        // A `color-mix()` ring computes to `color(srgb r g b)` with 0..1
        // channels; read as 0..255 it looks near-black and every ring would
        // pass on a false contrast. Same rule as the census parser above.
        const colour = m
          ? /^color\(srgb/.test(raw)
            ? m.map((v) => Math.round(v * 255))
            : m
          : null;
        return style !== 'none' && width > 0 ? colour : null;
      }, which);
    };
    const rings = {
      moon: await ringOf('moon'),
      figure: await ringOf('figure'),
    };
    for (const [name, colour] of Object.entries(rings)) {
      if (!colour) {
        fail(
          id(`A.focusRing.${name}`),
          `${name} focus ring visible (${theme})`,
          'no outline while focused',
          '2 px ring ≥ 3:1',
        );
        continue;
      }
      const c = contrast(colour, a.bg);
      check(
        c >= 3,
        id(`A.focusRing.${name}`),
        `${name} focus ring ≥ 3:1 against the page (${theme})`,
        `${fmt(c, 2)}:1 rgb(${colour}) on rgb(${a.bg})`,
        '≥ 3:1',
      );
    }
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
    // SwiftShader rasterises inside render() on the CPU, so this number is
    // recorded here and judged on the GPU pass (§7.7 "timing on GPU only").
    perfRow(
      'renderCpuMs',
      r,
      `avg ${fmt(frameMs.avg, 2)}, max ${fmt(frameMs.max, 2)}`,
      '≤ 1 ms avg',
      null,
      'SwiftShader: judged on the GPU pass',
    );
  else if (!vp.mobile)
    perfRow(
      'renderCpuMs',
      r,
      null,
      '≤ 1 ms',
      null,
      '__festival.frameMs() not exposed',
    );
  const settledSim = live.timelineSim?.settled;
  const settledWall =
    live.timeline.settled !== undefined
      ? live.timeline.settled -
        Math.max(
          live.timeline.canvas,
          Math.min(
            live.timeline.fontsReady ?? Infinity,
            live.timeline.canvas + 800,
          ),
        )
      : null;
  const settledMs =
    typeof settledSim === 'number' ? settledSim * 1000 : settledWall;
  perfRow(
    'settledMs',
    r,
    settledMs === null ? null : fmt(settledMs, 0),
    '≤ 4500',
    settledMs === null ? false : settledMs <= 4500,
    typeof settledSim === 'number'
      ? 'sim time (wall clock is GPU-pass only)'
      : 'wall clock on SwiftShader',
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
    const dev = await isDevTarget(page);
    perfRow(
      'festivalChunkBytes',
      r,
      chunkBytes,
      '≤ 46080 gz (excl. three)',
      dev || !chunks.length || !compressed ? null : chunkBytes <= 46080,
      dev
        ? `${chunks.length} chunks, ${chunkBytes} B — ${DEV_NOTE}`
        : `${chunks.length} chunks, ${compressed ? 'compressed' : 'uncompressed: recorded, not asserted'}`,
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
      const overlay = await page.evaluate(readOverlay);
      return { ...overlay, dev: await isDevTarget(page) };
    } finally {
      await ctx.close();
    }
  };
  const on = await load('1');
  const off = await load('0');
  if (on.dev) {
    // Unminified modules and the HMR client dominate the heap on `next dev`
    // (≈ 35 MB against a 12 MB budget); the row only means something on a
    // production build.
    perfRow('heapDeltaMB', '/blog', null, '≤ 12', null, DEV_NOTE);
  } else if (on.heap !== null && off.heap !== null) {
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
        const cpu = await page.evaluate(() => {
          try {
            return window.__festival?.frameMs?.() ?? null;
          } catch {
            return null;
          }
        });
        if (cpu && route !== '/orbital')
          perfRow(
            'renderCpuMs',
            route,
            `avg ${fmt(cpu.avg, 2)}, max ${fmt(cpu.max, 2)}`,
            '≤ 1 ms avg',
            cpu.avg <= 1,
            `GPU: ${renderer}`,
          );
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
      // The mount used to leave a hidden sentinel span after <main>'s siblings.
      const hiddenSpans = await page.evaluate(
        () => document.querySelectorAll('body > span[hidden]').length,
      );
      const expectedCanvases = path === '/' ? 1 : 0;
      const ok =
        o.festivalAttr === null &&
        o.canvasCount === expectedCanvases &&
        !o.hasApi &&
        !o.hasRoot &&
        hiddenSpans === 0 &&
        (o.webglContexts ?? 0) === expectedCanvases;
      check(
        ok,
        id(`kill${path}`),
        `${label}: zero festival DOM, no second canvas, no __festival on ${path}${flag === null && label === 'query' ? ' (persisted)' : ''}`,
        `data-festival=${o.festivalAttr} canvases=${o.canvasCount} webgl=${o.webglContexts} api=${o.hasApi} root=${o.hasRoot} body>span[hidden]=${hiddenSpans}`,
        `no attr, ${expectedCanvases} canvas, no api, 0 hidden spans`,
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
    args: [...RENDER_ARGS, ...COMMON_ARGS],
  });
  if (GPU)
    console.log(
      'capture browser on the GPU (--gpu): pixels are not run-stable',
    );
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
    if (!ONLY || ONLY.some((s) => 'orbital'.includes(s))) {
      console.log('\n--- moon night: light / → /orbital ---');
      await guarded('V4.moonNightRoute', () => moonNightRun({ browser }));
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
        'needs a second server: pass --off-url <server BUILT with NEXT_PUBLIC_FESTIVAL=0 (build-time switch; the static routes bake the mount at build)>',
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
