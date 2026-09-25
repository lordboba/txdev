'use client';

import { useCallback, useRef } from 'react';
import * as THREE from 'three';

import { usePointerListener } from '@/components/concept/shared/runtime';
import { featuredProjects } from '@/content/projectData';
import type { BlogPostMeta } from '@/lib/blog';
import { MOBILE_MEDIA_QUERY, festival } from '@/lib/festival';
import { dayOfYear, riddleFor, type Riddle } from '@/lib/festivalRiddles';
import {
  accentTints,
  hexToRgb01,
  light as lightRules,
  rgb01ToHex,
  siteTokens,
  type AccentTints,
} from './palette';
import { createFallObjects } from './scene/fall';
import {
  buildShadowStrip,
  COLLAR_POINT_Y,
  createLanternObjects,
} from './scene/lantern';
import { cameraZ, readLiveRects, routeLayout } from './scene/layout';
import { createMoonObjects, loadMoonTexture } from './scene/moon';
import { clamp, cubicBezier } from './scene/noise';
import { createPinWriter, slipPin, writePinVars } from './scene/projectPx';
import { createSim } from './scene/sim';
import {
  CHOREOGRAPHY,
  EASINGS,
  FESTIVAL_DATA_ATTRS,
  FESTIVAL_EVENTS,
  type FestivalDebugApi,
  type FrameContext,
  type MoonState,
  type Rect,
  type RouteLayout,
  type SimApi,
  type Viewport,
  type WindApi,
  type WorldPoint,
} from './scene/types';
import {
  claimWindListeners,
  createWind,
  releaseWindListeners,
} from './scene/wind';

/**
 * The raw three renderer and the layer's conductor (bible §4, §7.3, §7.4).
 *
 * `createFestivalRuntime` owns everything imperative: the WebGL context, the
 * 60 Hz clock (`wind.tick` → `sim.step` → scene updates → CSS pins), the
 * mount / route / theme choreography issued to the pure sim on sim time, the
 * pauses (§4.7), theme sampling with the hue gate, pointer velocity, and the
 * small view store the HTML overlay (`FestivalType`) renders from. The
 * `FestivalCanvas` component below is the thin React shell around it.
 */

// ---------------------------------------------------------------------------
// The view the HTML overlay renders from
// ---------------------------------------------------------------------------

export type TextPhase = 'hidden' | 'enter' | 'exit';
export type Timing = 'mount' | 'route';

export interface FestivalView {
  layout: RouteLayout | null;
  phase: TextPhase;
  /** Which §4 table's glyph/slip/translation durations the CSS uses. */
  timing: Timing;
  poemShown: boolean;
  colophonShown: boolean;
  slipShown: boolean;
  translationShown: boolean;
  riddle: Riddle | null;
  reduced: boolean;
  /** WebGL context lost or unavailable: the layer unmounts. */
  dead: boolean;
}

export interface FestivalRuntime {
  subscribe(listener: () => void): () => void;
  getView(): FestivalView;
  setRoute(pathname: string): void;
  /** Normalised pointer position (−1..1) from `usePointerListener`. */
  pointer(xNorm: number, yNorm: number): void;
  dispose(): void;
}

export interface RuntimeOptions {
  canvas: HTMLCanvasElement;
  /** The layer wrapper (`[data-festival-layer]`): receives the per-frame custom properties. */
  root: HTMLElement;
  seed: number;
  posts: readonly BlogPostMeta[];
  pathname: string;
}

const MOUNT = CHOREOGRAPHY.mount;
const ROUTE = CHOREOGRAPHY.route;
const THEME = CHOREOGRAPHY.theme;
const LOOP = CHOREOGRAPHY.loop;

const easeStd = cubicBezier(...EASINGS.std);
const easeLinear = (t: number) => clamp(t, 0, 1);

/** Elements whose presence pauses the loop (§4.7): modals and the Bench lightbox. */
const OVERLAY_SELECTOR = '[aria-modal="true"], [class*="lightbox"]';
/** Frames between overlay checks (a `querySelector` at 60 Hz is wasteful). */
const OVERLAY_CHECK_EVERY = 6;
const PAUSE_POLL_MS = 200;
/** Slip pin damping λ (§6.A3). */
const SLIP_DAMP_LAMBDA = 12;
/** When the route table has no moon the layout's setLayout waits for the exit. */
const ROUTE_RELAYOUT_S = (ROUTE.riseDelayMs + ROUTE.riseMs) / 1000; /* 0.28 */
/** A same-set resize re-anchors the moon over this long (§7.3 "re-anchor from px"). */
const RESIZE_MOON_MS = 200;

type Tween = {
  from: number;
  to: number;
  start: number;
  dur: number;
  ease: (t: number) => number;
};

function tweenAt(t: Tween | null, ts: number, fallback: number): number {
  if (!t) return fallback;
  if (t.dur <= 0) return t.to;

  const k = clamp((ts - t.start) / t.dur, 0, 1);

  return t.from + (t.to - t.from) * t.ease(k);
}

function tween(
  from: number,
  to: number,
  start: number,
  durMs: number,
  ease = easeStd,
): Tween {
  return { from, to, start, dur: durMs / 1000, ease };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readAccent(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();

  return /^#[0-9a-f]{6}$/i.test(value) ? value : siteTokens.accent.dark;
}

function displayFamily(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-display')
    .trim();

  return value || "'Cormorant Garamond', serif";
}

function mixTints(a: AccentTints, b: AccentTints, t: number): AccentTints {
  if (t <= 0) return a;
  if (t >= 1) return b;

  const mix = (x: string, y: string) => {
    const cx = hexToRgb01(x);
    const cy = hexToRgb01(y);

    return rgb01ToHex([
      cx[0] + (cy[0] - cx[0]) * t,
      cx[1] + (cy[1] - cx[1]) * t,
      cx[2] + (cy[2] - cx[2]) * t,
    ]);
  };

  return {
    pool: mix(a.pool, b.pool),
    halo: mix(a.halo, b.halo),
    passed: b.passed,
  };
}

/** The layout shell outside the allow-list: nothing placed, nothing falling. */
function emptyLayout(viewport: Viewport, mobile: boolean): RouteLayout {
  return {
    route: '/',
    viewport: { ...viewport },
    mobile,
    home: false,
    zIndex: 1,
    overlayZIndex: 1,
    lanterns: [],
    moon: null,
    florets: {
      count: 0,
      emitters: [],
      exclusions: [],
      featherPx: 0,
      alphaMax: 1,
      alphaRampY: null,
      trackSelector: null,
    },
    text: {
      poem: null,
      colophon: null,
      colophonOrientation: 'vertical',
      translation: null,
      translationAlign: 'right',
    },
    exclusions: [],
    textExclusions: [],
    navBottom: 0,
    halo: false,
    poolPeak: 0,
    ignoresTheme: false,
    scrollLift: null,
    moonScrollDim: null,
    riddlePool: null,
    routeSeed: 0,
  };
}

// ---------------------------------------------------------------------------
// The runtime
// ---------------------------------------------------------------------------

export function createFestivalRuntime(
  options: RuntimeOptions,
): FestivalRuntime {
  const { canvas, root, seed, posts } = options;
  const html = document.documentElement;
  const debug =
    new URLSearchParams(window.location.search).get('bench-debug') === '1';

  // ---- view store ---------------------------------------------------------
  let view: FestivalView = {
    layout: null,
    phase: 'hidden',
    timing: 'mount',
    poemShown: false,
    colophonShown: false,
    slipShown: false,
    translationShown: false,
    riddle: null,
    reduced: false,
    dead: false,
  };
  const listeners = new Set<() => void>();
  const setView = (patch: Partial<FestivalView>) => {
    view = { ...view, ...patch };
    listeners.forEach((listener) => listener());
  };

  // ---- environment ----------------------------------------------------------
  const mobileQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const viewport: Viewport = { w: window.innerWidth, h: window.innerHeight };
  let mobile = mobileQuery.matches;
  let reduced = reducedQuery.matches;
  let pathname = options.pathname;
  let disposed = false;
  let started = false;

  // ---- wind + sim -----------------------------------------------------------
  const wind: WindApi = createWind(seed);
  const windToken = claimWindListeners(window);
  let sim: SimApi | null = null;
  let layout: RouteLayout = resolveLayout(pathname);
  let sequenceId = 0;

  function resolveLayout(path: string): RouteLayout {
    // Outside the allow-list the mount is gone (FestivalMount); keep a shell.
    return (
      routeLayout(path, { ...viewport }, mobile, readLiveRects()) ??
      emptyLayout(viewport, mobile)
    );
  }

  // ---- renderer -------------------------------------------------------------
  let renderer: THREE.WebGLRenderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
  } catch {
    return deadRuntime();
  }

  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    30,
    viewport.w / viewport.h,
    0.1,
    40,
  );

  const lanterns = createLanternObjects(renderer);
  const fall = createFallObjects(renderer);
  const moonTexture = loadMoonTexture(undefined, undefined, () => torn);
  // The moon borrows the fall system's unit plane: 6 geometries on the page (§7.5).
  const moon = createMoonObjects(renderer, moonTexture, fall.geometry);

  scene.add(lanterns.object, fall.object, moon.object);

  function applySize() {
    viewport.w = window.innerWidth;
    viewport.h = window.innerHeight;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, mobile || layout.home ? 1 : 1.5),
    );
    renderer.setSize(viewport.w, viewport.h, false);
    camera.aspect = viewport.w / viewport.h;
    camera.position.z = cameraZ(viewport.h);
    camera.updateProjectionMatrix();
  }

  applySize();

  // ---- per-frame state ------------------------------------------------------
  let nightTarget: 0 | 1 = 1;
  let night = 1;
  /** The moon's own §4.3 blend (900 ms std to full, 500 ms back to 7%). */
  let moonNightTween: Tween | null = null;
  let moonNight = 1;
  let skyFade: Tween | null = null;
  let floretFade: Tween | null = null;
  let tintsFrom: AccentTints = accentTints(siteTokens.accent.dark);
  let tintsTo: AccentTints = tintsFrom;
  let tintTween: Tween | null = null;
  let tints: AccentTints = tintsFrom;
  let lastAccent = '';
  let lastDark: boolean | null = null;

  const moonState: MoonState = {
    centre: { x: 0, y: 0 },
    diameter: 0,
    alpha: 0,
    haloAlpha: 0,
    visible: false,
  };
  let moonX: Tween | null = null;
  let moonY: Tween | null = null;
  let moonD: Tween | null = null;
  let moonAlpha: Tween | null = null;
  let moonHalo: Tween | null = null;
  let moonDim: Tween | null = null;
  let moonDimTarget = 1;
  /** The route being entered has a moon (known before `layout` swaps). */
  let moonWanted = false;

  const slipCollar: WorldPoint = { x: 0, y: 0, z: 0 };
  const slipPx = { x: 0, y: 0, thetaDeg: 0 };
  const slipLive = { x: NaN, y: NaN };
  let slipGapPx = 0;
  let slipSpec: (typeof layout.lanterns)[number] | null = null;
  const pins = createPinWriter(root);
  /** Mobile `/`: the element the floret band tracks, read once per scrolled frame. */
  let trackElement: Element | null = null;
  const trackRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let shadowStrip: THREE.DataTexture | null = null;
  let contextLost = false;

  let frames = 0;
  let torn = false;
  let rafId = 0;
  let pauseTimer = 0;
  let lastFrameMs = 0;
  let overlayCheck = 0;
  let overlayOpen = false;
  let canvasVisible = true;
  let lifted = false;
  let launched = false;
  let settledScheduled = false;
  let lastTrackScroll = -1;

  const frame: FrameContext = {
    ts: 0,
    dt: 0,
    viewport,
    mobile,
    home: layout.home,
    night,
    moonNight,
    tints,
    cameraZ: camera.position.z,
    layout,
  };

  // ---- theme ------------------------------------------------------------------
  function sampleTheme(): { nightChanged: boolean } {
    const dark = html.getAttribute(FESTIVAL_DATA_ATTRS.theme) !== 'light';
    const accent = readAccent();
    const nextNight: 0 | 1 = layout.ignoresTheme || dark ? 1 : 0;
    const nightChanged = nextNight !== nightTarget;

    nightTarget = nextNight;
    lastDark = dark;

    if (accent !== lastAccent) {
      lastAccent = accent;
      const next = accentTints(accent);

      if (next.pool !== tintsTo.pool || next.halo !== tintsTo.halo) {
        tintsFrom = tints;
        tintsTo = next;
        tintTween = sim
          ? tween(0, 1, sim.state.ts, THEME.tintDampMs, easeLinear)
          : null;
        if (!tintTween) tints = next;
      }
      root.style.setProperty('--festival-pool-tint', next.pool);
      root.style.setProperty('--festival-halo-tint', next.halo);
    }

    return { nightChanged };
  }

  function onThemeChange() {
    const dark = html.getAttribute(FESTIVAL_DATA_ATTRS.theme) !== 'light';

    if (dark === lastDark && readAccent() === lastAccent) return;

    const { nightChanged } = sampleTheme();

    if (!sim) return;
    sim.setNight(nightTarget);

    if (reduced) {
      renderReduced();

      return;
    }
    if (!nightChanged) return;

    // §4.3: dusk catches the candles in order; morning snuffs them at once.
    for (const spec of layout.lanterns) {
      if (nightTarget === 1) {
        sim.light(spec.id, {
          delayS:
            (THEME.candleDelayMs + THEME.candleStaggerMs * spec.order) / 1000,
          durationS: THEME.candleMs / 1000,
          target: 1,
        });
      } else {
        sim.light(spec.id, {
          delayS: 0,
          durationS: THEME.snuffMs / 1000,
          target: 0,
          easing: 'exit',
          poolDurationS: THEME.poolOutMs / 1000,
        });
      }
    }
    // The moon: 7% → full over 900 ms std at dusk, back over 500 ms at morning.
    moonNightTween = tween(
      moonNight,
      nightTarget,
      sim.state.ts,
      nightTarget === 1 ? THEME.moonMs : THEME.moonOutMs,
    );
  }

  const themeObserver = new MutationObserver(onThemeChange);

  themeObserver.observe(html, {
    attributes: true,
    attributeFilter: [
      FESTIVAL_DATA_ATTRS.theme,
      FESTIVAL_DATA_ATTRS.colorTheme,
    ],
  });
  window.addEventListener(FESTIVAL_EVENTS.theme, onThemeChange);

  sampleTheme();
  night = nightTarget;
  moonNight = nightTarget;

  // ---- layout ------------------------------------------------------------------
  function writeTextRects(next: RouteLayout) {
    const { poem, colophon, translation } = next.text;

    writePinVars(root, {
      poemX: poem?.x ?? null,
      poemY: poem?.y ?? null,
      colophonX: colophon?.x ?? null,
      colophonY: colophon?.y ?? null,
      translationX: translation?.x ?? null,
      translationY: translation?.y ?? null,
    });
    setPx('--colophon-w', colophon && next.home ? colophon.w : null);
    setPx('--translation-w', translation?.w ?? null);

    // The riddle card: left edge relative to the strip's left, and its width.
    const slip = next.lanterns.find((l) => l.slip && l.slipRect && l.cardRect);

    setPx(
      '--card-left',
      slip?.cardRect && slip.slipRect
        ? slip.cardRect.x - slip.slipRect.x
        : null,
    );
    setPx('--card-w', slip?.cardRect?.w ?? null);
  }

  function setPx(name: string, value: number | null) {
    if (value === null) root.style.removeProperty(name);
    else root.style.setProperty(name, `${Math.round(value * 100) / 100}px`);
  }

  function slipGapFor(next: RouteLayout): number {
    const spec = next.lanterns.find((l) => l.slip && l.slipRect);

    if (!spec || !spec.slipRect) return 0;

    // Bottom-collar point at rest, px: body centre minus the local collar y.
    const restCollarY =
      spec.bodyRect.y + spec.bodyRect.h / 2 - COLLAR_POINT_Y * spec.body;

    return spec.slipRect.y - restCollarY;
  }

  /**
   * Moves the moon to a layout's anchor: a glide when it is already up (§4.2
   * route change, 600 ms; a same-set resize, 200 ms), the §4.1 fade-in when
   * it is not, the 280 ms fade-out when the layout has none.
   */
  function moonEnter(
    next: RouteLayout,
    ts: number,
    glideMs: number = ROUTE.moonGlideMs,
    keepDim = false,
  ) {
    const anchor = next.moon;

    moonWanted = anchor !== null;
    if (anchor) {
      if (moonState.visible && moonState.alpha > 0.01) {
        // §4.2: the moon is shared; it glides to the new anchor.
        moonX = tween(moonState.centre.x, anchor.centre.x, ts, glideMs);
        moonY = tween(moonState.centre.y, anchor.centre.y, ts, glideMs);
        moonD = tween(moonState.diameter, anchor.diameter, ts, glideMs);
        moonAlpha = tween(
          tweenAt(moonAlpha, ts, moonState.alpha),
          1,
          ts,
          glideMs,
        );
        moonHalo = tween(
          moonState.haloAlpha,
          lightRules.moon.halo.peakDark,
          ts,
          glideMs,
        );
      } else {
        moonX = moonY = moonD = null;
        moonState.centre.x = anchor.centre.x;
        moonState.centre.y = anchor.centre.y;
        moonState.diameter = anchor.diameter;
        moonAlpha = tween(0, 1, ts, MOUNT.moonFadeMs);
        moonHalo = tween(
          0,
          lightRules.moon.halo.peakDark,
          ts + MOUNT.moonHaloDelayMs / 1000,
          MOUNT.moonHaloMs,
        );
      }
      moonState.visible = true;
    } else if (moonState.visible) {
      moonAlpha = tween(moonState.alpha, 0, ts, ROUTE.moonFadeMs);
      moonHalo = tween(moonState.haloAlpha, 0, ts, ROUTE.moonFadeMs);
    }
    if (!keepDim) {
      moonDim = null;
      moonDimTarget = 1;
    }
  }

  /**
   * Swaps the composition. On a route change the moon rows already ran at
   * the anchor re-read (`moonDone`), 220 ms before the lanterns are rebuilt.
   */
  function applyLayout(
    next: RouteLayout,
    reason: 'mount' | 'route' | 'resize',
    moonDone = false,
  ) {
    if (!sim) return;

    const homeChanged = next.home !== frame.home;

    layout = next;
    frame.layout = next;
    frame.home = next.home;
    frame.mobile = mobile;
    if (homeChanged) applySize();

    sim.setLayout(next, reason);
    lanterns.build(next.lanterns, frame);
    fall.build(next.florets.count, frame);
    slipGapPx = slipGapFor(next);
    slipSpec = next.lanterns.find((l) => l.slip) ?? null;
    slipLive.x = NaN;
    trackElement = null;
    writeTextRects(next);

    if (reason === 'resize') {
      // §7.3: re-anchor from px. The moon follows its new anchor (or leaves
      // when the narrower viewport dropped it); the scroll dim is kept.
      moonEnter(next, sim.state.ts, RESIZE_MOON_MS, true);
    } else {
      if (!moonDone) moonEnter(next, sim.state.ts);
      lifted = false;
      sampleTheme();
      sim.setNight(nightTarget);
    }
  }

  function riddleFor_(next: RouteLayout): Riddle | null {
    if (!next.riddlePool) return null;

    return riddleFor(
      next.riddlePool,
      dayOfYear(new Date()),
      next.routeSeed,
      posts,
      festival.script,
    );
  }

  // ---- choreography -------------------------------------------------------------
  function guard(id: number, fn: () => void) {
    return () => {
      if (!disposed && id === sequenceId) fn();
    };
  }

  function clearSettled() {
    settledScheduled = false;
    html.removeAttribute(FESTIVAL_DATA_ATTRS.settled);
  }

  /** §4.1 (mount) or §4.2 enter rows, with delays measured from `base` (sim s). */
  function enterSequence(timing: Timing, base: number) {
    if (!sim) return;

    const T = timing === 'mount' ? MOUNT : ROUTE;
    const now = sim.state.ts;
    const id = sequenceId;
    const lowerDelay = timing === 'mount' ? 0 : ROUTE.lowerInDelayMs;

    for (const spec of layout.lanterns) {
      const lowerAt =
        base + (lowerDelay + T.lanternStaggerMs * spec.order) / 1000;
      const arrival = lowerAt + T.lowerInMs / 1000;

      sim.lowerIn(spec.id, {
        delayS: Math.max(0, lowerAt - now),
        durationS: T.lowerInMs / 1000,
      });
      // The catch is decided when it is due: a theme flip during the
      // lower-in (dark → light) must leave the candle out (§2.1).
      sim.schedule(
        arrival + T.candleDelayMs / 1000,
        guard(id, () => {
          if (nightTarget !== 1 || !sim) return;
          sim.light(spec.id, {
            delayS: 0,
            durationS: T.candleMs / 1000,
            target: 1,
            poolDelayS: T.poolDelayMs / 1000,
            poolDurationS: T.poolMs / 1000,
          });
        }),
      );
    }

    setView({
      layout,
      phase: 'enter',
      timing,
      poemShown: false,
      colophonShown: false,
      slipShown: false,
      translationShown: false,
      riddle: riddleFor_(layout),
      reduced,
    });
    clearSettled();

    sim.schedule(
      base + T.poemStartMs / 1000,
      guard(id, () => setView({ poemShown: true })),
    );
    sim.schedule(
      base + T.colophonStartMs / 1000,
      guard(id, () => setView({ colophonShown: true })),
    );
    sim.schedule(
      base + T.slipStartMs / 1000,
      guard(id, () => setView({ slipShown: true })),
    );
  }

  /** §4.2 exit rows: text out, candles out, lanterns up. */
  function exitSequence() {
    if (!sim) return;

    setView({ phase: 'exit' });
    clearSettled();
    for (const spec of layout.lanterns) {
      sim.light(spec.id, {
        delayS: 0,
        durationS: ROUTE.candleOutMs / 1000,
        target: 0,
      });
      sim.raise(spec.id, {
        delayS: ROUTE.riseDelayMs / 1000,
        durationS: ROUTE.riseMs / 1000,
        px: ROUTE.risePx,
      });
    }
  }

  function routeChange(path: string) {
    if (!sim) return;

    sequenceId += 1;

    const id = sequenceId;

    if (reduced) {
      applyLayout(resolveLayout(path), 'route');
      renderReduced();

      return;
    }

    const base = sim.state.ts;
    let pending: RouteLayout | null = null;

    if (launched) {
      launched = false;
    } else {
      exitSequence();
    }

    sim.schedule(
      base + ROUTE.anchorRereadDelayMs / 1000,
      guard(id, () => {
        pending = resolveLayout(path);
        moonEnter(pending, sim!.state.ts);
      }),
    );
    sim.schedule(
      base + ROUTE_RELAYOUT_S,
      guard(id, () => {
        const moonDone = pending !== null;

        applyLayout(pending ?? resolveLayout(path), 'route', moonDone);
        // §4.2: the enter's settle floor/ceiling count from the navigation.
        sim?.setSequenceStart(base);
        enterSequence('route', base);
      }),
    );
  }

  function onLaunch() {
    if (!sim || reduced || launched) return;
    sequenceId += 1;
    exitSequence();
    launched = true;
  }

  window.addEventListener(FESTIVAL_EVENTS.launch, onLaunch);

  // ---- mobile scroll-lift (§3.3) and moon scroll-dim (§3.4) ----------------------
  function stepScroll() {
    if (!sim) return;

    const y = window.scrollY;
    const lift = layout.scrollLift;

    if (lift && layout.lanterns.length && view.phase === 'enter') {
      if (!lifted && y > lift.liftAtScrollY) {
        lifted = true;
        for (const spec of layout.lanterns) {
          sim.light(spec.id, {
            delayS: 0,
            durationS: ROUTE.candleOutMs / 1000,
            target: 0,
          });
          sim.raise(spec.id, {
            delayS: ROUTE.riseDelayMs / 1000,
            durationS: lift.ms / 1000,
            px: lift.px,
          });
        }
      } else if (lifted && y < lift.returnBelowScrollY) {
        lifted = false;
        for (const spec of layout.lanterns) {
          const lowerDelay =
            (ROUTE.lowerInDelayMs + ROUTE.lanternStaggerMs * spec.order) / 1000;
          const id = sequenceId;

          sim.lowerIn(spec.id, {
            delayS: lowerDelay,
            durationS: ROUTE.lowerInMs / 1000,
          });
          sim.schedule(
            sim.state.ts +
              lowerDelay +
              (ROUTE.lowerInMs + ROUTE.candleDelayMs) / 1000,
            guard(id, () => {
              if (nightTarget !== 1 || !sim) return;
              sim.light(spec.id, {
                delayS: 0,
                durationS: ROUTE.candleMs / 1000,
                target: 1,
                poolDelayS: ROUTE.poolDelayMs / 1000,
                poolDurationS: ROUTE.poolMs / 1000,
              });
            }),
          );
        }
      }
    }

    const dim = layout.moonScrollDim;

    if (dim) {
      const target = y > dim.afterScrollY ? dim.to : 1;

      if (target !== moonDimTarget) {
        moonDimTarget = target;
        moonDim = tween(
          tweenAt(moonDim, sim.state.ts, 1),
          target,
          sim.state.ts,
          dim.ms,
        );
      }
    }

    // Mobile `/`: the floret band follows the studio canvas as it scrolls.
    // One rect read of the tracked element, moved in place (no re-resolve).
    const selector = layout.florets.trackSelector;

    if (selector && y !== lastTrackScroll) {
      lastTrackScroll = y;
      if (!trackElement?.isConnected) {
        trackElement = document.querySelector(selector);
      }
      if (trackElement) {
        const r = trackElement.getBoundingClientRect();

        trackRect.x = r.left;
        trackRect.y = r.top;
        trackRect.w = r.width;
        trackRect.h = r.height;
        sim.setEmitterRect(0, trackRect);
      }
    }
  }

  // ---- loop ------------------------------------------------------------------------
  function shouldPause(): boolean {
    if (document.hidden || !canvasVisible) return true;
    if (html.hasAttribute(FESTIVAL_DATA_ATTRS.journeyOpen)) return true;
    overlayCheck += 1;
    if (overlayCheck % OVERLAY_CHECK_EVERY === 1) {
      overlayOpen = document.querySelector(OVERLAY_SELECTOR) !== null;
    }

    return overlayOpen;
  }

  function pauseLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    lastFrameMs = 0;
    wind.pause();
    window.clearTimeout(pauseTimer);
    pauseTimer = window.setTimeout(pollResume, PAUSE_POLL_MS);
  }

  function pollResume() {
    if (disposed || reduced) return;
    overlayCheck = 0;
    if (shouldPause()) {
      pauseTimer = window.setTimeout(pollResume, PAUSE_POLL_MS);

      return;
    }
    wind.resume();
    rafId = requestAnimationFrame(tick);
  }

  function tick(nowMs: number) {
    rafId = 0;
    if (disposed || !sim) return;
    if (shouldPause()) {
      pauseLoop();

      return;
    }
    if (nowMs - lastFrameMs < LOOP.minFrameGapMs) {
      rafId = requestAnimationFrame(tick);

      return;
    }
    lastFrameMs = nowMs;

    const dt = wind.tick(nowMs);

    if (dt > 0) {
      sim.step(dt);
      stepScroll();
      advance(dt);
      render(dt);
    }
    rafId = requestAnimationFrame(tick);
  }

  /** Damps and tweens that live outside the sim. */
  function advance(dt: number) {
    if (!sim) return;

    const ts = sim.state.ts;

    night +=
      (nightTarget - night) * (1 - Math.exp(-THEME.nightDampLambda * dt));
    if (Math.abs(nightTarget - night) < 0.002) night = nightTarget;
    moonNight = tweenAt(moonNightTween, ts, moonNight);
    if (moonNightTween && ts >= moonNightTween.start + moonNightTween.dur) {
      moonNightTween = null;
    }

    if (tintTween) {
      const k = tweenAt(tintTween, ts, 1);

      tints = mixTints(tintsFrom, tintsTo, k);
      if (k >= 1) tintTween = null;
    }

    if (moonState.visible) {
      moonState.centre.x = tweenAt(moonX, ts, moonState.centre.x);
      moonState.centre.y = tweenAt(moonY, ts, moonState.centre.y);
      moonState.diameter = tweenAt(moonD, ts, moonState.diameter);
      moonState.alpha =
        tweenAt(moonAlpha, ts, moonState.alpha) *
        tweenAt(moonDim, ts, moonDimTarget);
      moonState.haloAlpha = tweenAt(moonHalo, ts, moonState.haloAlpha);
      if (!moonWanted && moonState.alpha <= 0.001) moonState.visible = false;
    }

    // Translation lands at the settle event; `data-festival-settled` 500 ms later.
    if (view.phase === 'enter' && sim.state.settled) {
      if (!view.translationShown) setView({ translationShown: true });
      if (!settledScheduled) {
        settledScheduled = true;
        const id = sequenceId;

        sim.schedule(
          ts + MOUNT.settledAfterTranslationMs / 1000,
          guard(id, () =>
            html.setAttribute(FESTIVAL_DATA_ATTRS.settled, 'true'),
          ),
        );
      }
    }
  }

  function render(dt: number) {
    if (!sim) return;

    const state = sim.state;

    frame.ts = state.ts;
    frame.dt = dt;
    frame.night = night;
    frame.moonNight = moonNight;
    frame.tints = tints;
    frame.cameraZ = camera.position.z;
    frame.layout = layout;
    frame.mobile = mobile;
    frame.home = layout.home;

    lanterns.update(state.lanterns, layout.lanterns, frame);
    fall.update(state.fall, frame, tweenAt(floretFade, state.ts, 1));
    moon.update(moonState, frame);
    renderer.render(scene, camera);
    frames += 1;

    writePins(dt);
  }

  /** The per-frame custom properties; the writer skips values that did not change. */
  function writePins(dt: number) {
    if (!sim) return;

    const state = sim.state;
    const sky = tweenAt(skyFade, state.ts, 1);
    let slipState: (typeof state.lanterns)[number] | undefined;

    if (slipSpec) {
      for (const l of state.lanterns) if (l.id === slipSpec.id) slipState = l;
    }

    let slipX: number | null = null;
    let slipY: number | null = null;
    let slipTheta: number | null = null;

    if (slipSpec && slipState) {
      lanterns.collarPoint(slipSpec.id, slipCollar);
      slipPin(slipCollar, slipState, viewport, slipPx);
      const targetY = slipPx.y + slipGapPx;

      if (Number.isNaN(slipLive.x) || reduced) {
        slipLive.x = slipPx.x;
        slipLive.y = targetY;
      } else {
        const k = 1 - Math.exp(-SLIP_DAMP_LAMBDA * dt);

        slipLive.x += (slipPx.x - slipLive.x) * k;
        slipLive.y += (targetY - slipLive.y) * k;
      }
      slipX = slipLive.x;
      slipY = slipLive.y;
      slipTheta = slipPx.thetaDeg;
    }

    const moonOn = moonState.visible && moonState.alpha > 0.001;
    const v = pins.values;

    v.night = night * sky;
    v.moonX = moonOn ? moonState.centre.x : null;
    v.moonY = moonOn ? moonState.centre.y : null;
    v.moonD = moonOn ? moonState.diameter : null;
    v.slipX = slipX;
    v.slipY = slipY;
    v.slipTheta = slipTheta;
    v.poemTheta = state.poem.leanDeg;
    pins.write();
  }

  // ---- reduced motion (§4.6) ------------------------------------------------------
  function renderReduced() {
    if (!sim) return;

    sim.snapshotReduced();
    night = nightTarget;
    moonNight = nightTarget;
    moonNightTween = null;
    tints = tintsTo;
    tintTween = null;
    skyFade = null;
    floretFade = null;
    if (layout.moon) {
      moonX = moonY = moonD = moonAlpha = moonHalo = moonDim = null;
      moonState.centre.x = layout.moon.centre.x;
      moonState.centre.y = layout.moon.centre.y;
      moonState.diameter = layout.moon.diameter;
      moonState.alpha = 1;
      moonState.haloAlpha = lightRules.moon.halo.peakDark;
      moonState.visible = true;
    } else {
      moonState.visible = false;
      moonState.alpha = 0;
    }
    setView({
      layout,
      phase: 'enter',
      poemShown: true,
      colophonShown: true,
      slipShown: true,
      translationShown: true,
      riddle: riddleFor_(layout),
      reduced: true,
    });
    html.setAttribute(FESTIVAL_DATA_ATTRS.settled, 'true');
    settledScheduled = true;
    render(0);
  }

  function onReducedChange() {
    reduced = reducedQuery.matches;
    if (!sim) return;
    if (reduced) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      window.clearTimeout(pauseTimer);
      renderReduced();
    } else {
      setView({ reduced: false });
      wind.resume();
      lastFrameMs = 0;
      if (!rafId) rafId = requestAnimationFrame(tick);
    }
  }

  reducedQuery.addEventListener('change', onReducedChange);

  // ---- resize / visibility ---------------------------------------------------------
  let resizeRaf = 0;

  function onResize() {
    if (resizeRaf || !sim) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (disposed || !sim) return;

      const nextMobile = mobileQuery.matches;
      const next = routeLayout(
        pathname,
        { w: window.innerWidth, h: window.innerHeight },
        nextMobile,
        readLiveRects(),
      );

      if (!next) return;

      const sameSet =
        nextMobile === mobile &&
        next.lanterns.map((l) => l.id).join() ===
          layout.lanterns.map((l) => l.id).join();

      mobile = nextMobile;
      applySize();
      if (sameSet) {
        applyLayout(next, 'resize');
        if (reduced) renderReduced();
      } else {
        routeChange(pathname);
      }
    });
  }

  window.addEventListener('resize', onResize);
  mobileQuery.addEventListener('change', onResize);

  const intersection =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          canvasVisible = entries[0]?.isIntersecting ?? true;
        })
      : null;

  intersection?.observe(canvas);

  // ---- input ----------------------------------------------------------------------
  const pointerLast = { x: 0, y: 0, ms: 0 };

  function pointer(xNorm: number, yNorm: number) {
    if (reduced || disposed) return;

    const x = ((xNorm + 1) / 2) * viewport.w;
    const y = ((yNorm + 1) / 2) * viewport.h;
    const ms = performance.now();
    const dtS = (ms - pointerLast.ms) / 1000;

    if (pointerLast.ms > 0 && dtS > 0.004) {
      wind.cursor((x - pointerLast.x) / dtS, { x, y }, viewport);
    }
    pointerLast.x = x;
    pointerLast.y = y;
    pointerLast.ms = ms;
  }

  function onTouch(event: TouchEvent) {
    if (reduced) return;

    const touch = event.touches[0];

    if (touch) wind.touch({ x: touch.clientX, y: touch.clientY }, viewport);
  }

  window.addEventListener('touchstart', onTouch, { passive: true });

  /** §7.6: no restore attempt (no preventDefault), no second context: the layer dies. */
  function onContextLost() {
    contextLost = true;
    teardown();
    setView({ dead: true });
  }

  canvas.addEventListener('webglcontextlost', onContextLost);

  // ---- start (§4.1: t = 0 when fonts are ready or 800 ms elapsed) ---------------
  const family = displayFamily();
  const fontsReady: Promise<unknown> = Promise.all([
    document.fonts.ready,
    document.fonts.load(`600 96px ${family}`).catch(() => []),
  ]);

  void Promise.race([fontsReady, sleep(MOUNT.fontsReadyTimeoutMs)]).then(start);

  void fontsReady.then(() => {
    if (disposed || torn) return;
    try {
      shadowStrip = buildShadowStrip(
        featuredProjects.map((project) => project.title),
        family,
      );
      lanterns.setShadowStrip(shadowStrip);
    } catch {
      shadowStrip = null;
      lanterns.setShadowStrip(null);
    }
  });

  function start() {
    if (disposed || started) return;
    started = true;

    const instance = createSim({
      seed,
      layout,
      wind,
      night: nightTarget,
      reducedMotion: reduced,
    });

    sim = instance;
    applyLayout(layout, 'mount');
    instance.prewarm(MOUNT.prewarmS);

    const ts = instance.state.ts;

    canvas.style.opacity = '1';
    if (reduced) {
      renderReduced();

      return;
    }
    skyFade = tween(0, 1, ts, MOUNT.moonFadeMs);
    floretFade = tween(0, 1, ts, MOUNT.floretFadeMs);
    enterSequence('mount', ts);
    lastFrameMs = 0;
    wind.resume();
    rafId = requestAnimationFrame(tick);
  }

  // ---- debug (§7.1) ------------------------------------------------------------------
  type DebugWindow = Window & { __festival?: FestivalDebugApi };

  if (debug) {
    const api: FestivalDebugApi = {
      wind: (t?: number, x01 = 0.5) => wind.sample(x01, t),
      rendererInfo: () => renderer.info,
      theta: () => sim?.state.lanterns.map((l) => l.theta) ?? [],
      tassel: () => sim?.state.lanterns.map((l) => l.tasselTheta) ?? [],
      frames: () => frames,
      layout: () => layout,
      time: () => wind.time(),
      state: () => sim?.state ?? null,
      view: () => view,
      moon: () => moonState,
      gusts: () => wind.gusts(),
      strip: () => shadowStrip?.userData ?? null,
    };

    (window as DebugWindow).__festival = api;
  }

  // ---- teardown --------------------------------------------------------------------
  function teardown() {
    if (torn) return;
    torn = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    window.clearTimeout(pauseTimer);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    themeObserver.disconnect();
    intersection?.disconnect();
    window.removeEventListener(FESTIVAL_EVENTS.theme, onThemeChange);
    window.removeEventListener(FESTIVAL_EVENTS.launch, onLaunch);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('touchstart', onTouch);
    mobileQuery.removeEventListener('change', onResize);
    reducedQuery.removeEventListener('change', onReducedChange);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    html.removeAttribute(FESTIVAL_DATA_ATTRS.settled);
    sim?.dispose();
    sim = null;
    lanterns.dispose();
    shadowStrip = null;
    fall.dispose();
    moon.dispose();
    moonTexture.dispose();
    renderer.dispose();
    // Free the GL context (§7.5 budgets contexts) once the canvas has left
    // the DOM. Deferred: React StrictMode remounts on the same canvas in the
    // same commit and would inherit a lost context; a real unmount has
    // detached the canvas by the next task. A lost context has nothing to release.
    if (!contextLost) {
      setTimeout(() => {
        if (!canvas.isConnected) renderer.forceContextLoss();
      }, 0);
    }
    if (debug) delete (window as DebugWindow).__festival;
  }

  function deadRuntime(): FestivalRuntime {
    view = { ...view, dead: true };

    return {
      subscribe: (listener) => {
        listeners.add(listener);

        return () => listeners.delete(listener);
      },
      getView: () => view,
      setRoute: () => {},
      pointer: () => {},
      dispose: () => releaseWindListeners(windToken),
    };
  }

  return {
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    getView: () => view,
    setRoute(path) {
      if (path === pathname) return;
      pathname = path;
      lastTrackScroll = -1;
      if (!sim) {
        layout = resolveLayout(path);

        return;
      }
      routeChange(path);
    },
    pointer,
    dispose() {
      disposed = true;
      teardown();
      releaseWindListeners(windToken);
    },
  };
}

// ---------------------------------------------------------------------------
// The React shell
// ---------------------------------------------------------------------------

export function FestivalCanvas({
  seed,
  posts,
  pathname,
  onRuntime,
}: {
  seed: number;
  posts: readonly BlogPostMeta[];
  pathname: string;
  onRuntime: (runtime: FestivalRuntime | null) => void;
}) {
  const runtimeRef = useRef<FestivalRuntime | null>(null);

  /**
   * Mount work as a ref callback with a cleanup (this repo's form instead of
   * effects). The `[data-festival-layer]` wrapper takes the per-frame custom
   * properties (both fixed roots inherit them); the route at mount is the
   * pathname FestivalMount gated on.
   */
  const mountCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      const root = canvas?.closest<HTMLElement>('[data-festival-layer]');

      if (!canvas || !root) return;

      const runtime = createFestivalRuntime({
        canvas,
        root,
        seed,
        posts,
        pathname,
      });

      runtimeRef.current = runtime;
      onRuntime(runtime);

      return () => {
        runtime.dispose();
        runtimeRef.current = null;
        onRuntime(null);
      };
    },
    // `pathname` is read once at mount; route changes arrive through the sentinel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, posts, onRuntime],
  );

  /** A sentinel whose ref callback re-runs on every pathname change (§4.2). */
  const routeSentinel = useCallback(
    (element: HTMLElement | null) => {
      if (element) runtimeRef.current?.setRoute(pathname);
    },
    [pathname],
  );

  const onMove = useCallback((x: number, y: number) => {
    runtimeRef.current?.pointer(x, y);
  }, []);

  usePointerListener(onMove);

  return (
    <>
      <canvas
        ref={mountCanvas}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          opacity: 0,
          transition: `opacity ${MOUNT.canvasFadeMs}ms linear`,
          pointerEvents: 'none',
        }}
      />
      <span ref={routeSentinel} hidden data-route={pathname} />
    </>
  );
}
