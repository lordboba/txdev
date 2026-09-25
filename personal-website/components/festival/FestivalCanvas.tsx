'use client';

import { useCallback, useRef } from 'react';
import * as THREE from 'three';

import { usePointerListener } from '@/components/concept/shared/runtime';
import { featuredProjects } from '@/content/projectData';
import type { BlogPostMeta } from '@/lib/blog';
import { MOBILE_MEDIA_QUERY, festival } from '@/lib/festival';
import { dayOfYear, riddleFor, type Riddle } from '@/lib/festivalRiddles';
import { light as lightRules, siteTokens } from './palette';
import { createFallObjects } from './scene/fall';
import {
  buildShadowStrip,
  COLLAR_POINT_Y,
  createLanternObjects,
} from './scene/lantern';
import { cameraZ, readLiveRects, routeLayout } from './scene/layout';
import { createLoop } from './scene/loop';
import { createMoonObjects, loadMoonTexture } from './scene/moon';
import { createMoonController } from './scene/moonController';
import { clamp } from './scene/noise';
import { createPinWriter, slipPin, writePinVars } from './scene/projectPx';
import { createSim } from './scene/sim';
import { createThemeSampler } from './scene/themeSampler';
import { tween, tweenAt, type Tween } from './scene/tween';
import {
  CHOREOGRAPHY,
  FESTIVAL_DATA_ATTRS,
  FESTIVAL_EVENTS,
  type FestivalDebugApi,
  type FrameContext,
  type Rect,
  type RouteLayout,
  type SimApi,
  type Vec2,
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
 * `createFestivalRuntime` owns the WebGL context and the sequencing: the
 * mount / route / theme choreography issued to the pure sim on sim time,
 * the pointer velocity and parallax, the CSS pins, and the small view store
 * the HTML overlay (`FestivalType`) renders from. The stateful pieces live in
 * their own modules with their own tests: `scene/loop.ts` (rAF, 60 Hz cap,
 * pause / resume, frame timing), `scene/themeSampler.ts` (theme + accent,
 * hue gate, the damped `uNight` and tints) and `scene/moonController.ts`
 * (glide / fade, scroll dim, the moon's day/night blend). The
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
  /** Read when a riddle is drawn, so a new `posts` array never rebuilds the runtime. */
  posts: () => readonly BlogPostMeta[];
  pathname: string;
}

const MOUNT = CHOREOGRAPHY.mount;
const ROUTE = CHOREOGRAPHY.route;
const THEME = CHOREOGRAPHY.theme;
const LOOP = CHOREOGRAPHY.loop;

/** Elements whose presence pauses the loop (§4.7): modals and the Bench lightbox. */
const OVERLAY_SELECTOR = '[aria-modal="true"], [class*="lightbox"]';
/** Frames between overlay checks (a `querySelector` at 60 Hz is wasteful). */
const OVERLAY_CHECK_EVERY = 6;
const PAUSE_POLL_MS = 200;
/** Slip pin damping λ (§6.A3). */
const SLIP_DAMP_LAMBDA = 12;
/** The exit's 280 ms: candle 160, rise from +40 over 240 (§4.2). */
const ROUTE_EXIT_S = (ROUTE.riseDelayMs + ROUTE.riseMs) / 1000; /* 0.28 */
/** A same-set resize re-anchors the moon over this long (§7.3 "re-anchor from px"). */
const RESIZE_MOON_MS = 200;
/**
 * An exit started at a link click is confirmed by the pathname change. If
 * none arrives within this long (a prevented navigation, a link Next handled
 * without a route change) the lanterns lower back in on the same page.
 */
const EXIT_CONFIRM_S = 4;
/** Pointer parallax (§4.5): px at parallax 1.0 for a full-width pointer travel, and its damping λ. */
const PARALLAX_PX: Vec2 = { x: 8, y: 4 };
const PARALLAX_LAMBDA = 6;

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
    navBand: null,
    halo: false,
    poolPeak: 0,
    ignoresTheme: false,
    scrollLift: null,
    moonScrollDim: null,
    riddlePool: null,
    routeSeed: 0,
  };
}

/** The internal pathname an anchor click will navigate to, or null. */
function internalLinkTarget(event: MouseEvent): string | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return null;

  const target = event.target;
  const anchor =
    target instanceof Element
      ? target.closest<HTMLAnchorElement>('a[href]')
      : null;

  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download'))
    return null;

  let url: URL;

  try {
    url = new URL(anchor.href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin || url.pathname === location.pathname)
    return null;

  return url.pathname;
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
  const moonObjects = createMoonObjects(renderer, moonTexture, fall.geometry);

  scene.add(lanterns.object, fall.object, moonObjects.object);

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

  // ---- theme, moon, fades ---------------------------------------------------
  const theme = createThemeSampler({
    isDark: () => html.getAttribute(FESTIVAL_DATA_ATTRS.theme) !== 'light',
    readAccent,
    onTints: (tints) => {
      root.style.setProperty('--festival-pool-tint', tints.pool);
      root.style.setProperty('--festival-halo-tint', tints.halo);
    },
  });
  const moon = createMoonController();
  let skyFade: Tween | null = null;
  let floretFade: Tween | null = null;

  // ---- pointer parallax (§4.5) ----------------------------------------------
  /** Damped normalised pointer (−1..1), decaying to 0 when the pointer leaves. */
  const pointerTarget: Vec2 = { x: 0, y: 0 };
  const pointerDamped: Vec2 = { x: 0, y: 0 };
  const parallax: Vec2 = { x: 0, y: 0 };

  // ---- pins and slip --------------------------------------------------------
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

  let torn = false;
  let overlayCheck = 0;
  let overlayOpen = false;
  let canvasVisible = true;
  let lifted = false;
  /** An exit already running for the next route (link click / rocket), awaiting the pathname. */
  let pendingExit: { path: string | null; at: number } | null = null;
  let settledScheduled = false;
  let lastTrackScroll = -1;
  /** Renders so far (the §7.5 / M8 frame counter: reduced motion renders once per state). */
  let frames = 0;

  const frame: FrameContext = {
    ts: 0,
    dt: 0,
    viewport,
    mobile,
    home: layout.home,
    night: theme.night,
    moonNight: moon.night,
    tints: theme.tints,
    cameraZ: camera.position.z,
    layout,
    parallax,
  };

  // ---- theme ------------------------------------------------------------------
  function onThemeChange() {
    if (!theme.changed()) return;

    const ts = sim?.state.ts ?? null;
    const { nightChanged } = theme.sample(layout.ignoresTheme, ts);

    if (!sim || ts === null) {
      // Before the loop starts (fonts wait) the state simply follows.
      theme.snap();
      moon.setNight(theme.nightTarget, 0);

      return;
    }
    sim.setNight(theme.nightTarget);

    if (reduced) {
      renderReduced();

      return;
    }
    if (!nightChanged) return;

    // §4.3: dusk catches the candles in order; morning snuffs them at once.
    for (const spec of layout.lanterns) {
      if (theme.nightTarget === 1) {
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
    moon.setNight(theme.nightTarget, ts);
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

  theme.sample(layout.ignoresTheme, null);
  theme.snap();
  moon.setNight(theme.nightTarget, 0);

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
   * Swaps the composition. On a route change the moon rows already ran at
   * the anchor re-read (`moonDone`), before the lanterns are rebuilt.
   */
  function applyLayout(
    next: RouteLayout,
    reason: 'mount' | 'route' | 'resize',
    moonDone = false,
  ) {
    if (!sim) return;

    const homeChanged = next.home !== frame.home;
    const ts = sim.state.ts;

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
      moon.enter(next, ts, RESIZE_MOON_MS, true);
    } else {
      if (!moonDone) moon.enter(next, ts);
      lifted = false;
      // The theme target follows the route (`/` ignores the theme): the
      // candles and the moon's own blend both retarget here, so a light
      // theme page entered from `/` never keeps a full night moon (§2.1).
      theme.sample(next.ignoresTheme, ts);
      sim.setNight(theme.nightTarget);
      moon.setNight(theme.nightTarget, ts);
    }
  }

  function riddleFor_(next: RouteLayout): Riddle | null {
    if (!next.riddlePool) return null;

    return riddleFor(
      next.riddlePool,
      dayOfYear(new Date()),
      next.routeSeed,
      posts(),
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
          if (theme.nightTarget !== 1 || !sim) return;
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

  /**
   * Starts the §4.2 exit at NAVIGATION START (a link click, the rocket),
   * not at the commit: `usePathname` changes only after Next has fetched
   * and committed the route (≈ 90 ms warm, seconds cold on dev), and the old
   * lanterns would otherwise rise over the new page. The pathname change
   * confirms it; if none arrives the lanterns lower back in.
   */
  function startExit(path: string | null) {
    if (!sim || reduced || pendingExit) return;

    sequenceId += 1;

    const id = sequenceId;

    exitSequence();
    pendingExit = { path, at: sim.state.ts };
    sim.schedule(
      sim.state.ts + EXIT_CONFIRM_S,
      guard(id, () => {
        if (!pendingExit || !sim) return;
        pendingExit = null;
        enterSequence('route', sim.state.ts - ROUTE.lowerInDelayMs / 1000);
      }),
    );
  }

  function onDocumentClick(event: MouseEvent) {
    const path = internalLinkTarget(event);

    if (path !== null) startExit(path);
  }

  document.addEventListener('click', onDocumentClick, true);

  function routeChange(path: string) {
    if (!sim) return;

    sequenceId += 1;

    const id = sequenceId;

    if (reduced) {
      pendingExit = null;
      applyLayout(resolveLayout(path), 'route');
      renderReduced();

      return;
    }

    const now = sim.state.ts;
    const exitAt =
      pendingExit && (pendingExit.path === null || pendingExit.path === path)
        ? pendingExit.at
        : null;

    pendingExit = null;
    if (exitAt === null) exitSequence();

    // The exit's 280 ms count from when it started; the new page is read no
    // earlier than 60 ms after the commit (§4.2 "anchor re-read").
    const rereadAt = now + ROUTE.anchorRereadDelayMs / 1000;
    const relayoutAt = Math.max(rereadAt, (exitAt ?? now) + ROUTE_EXIT_S);
    const base = relayoutAt - ROUTE_EXIT_S;
    const exitingBodies = layout.lanterns.map((l) => l.bodyRect);
    let pending: RouteLayout | null = null;
    let moonDone = false;

    // The new page paints on this commit, 60 ms before its anchors are
    // read: hand the moon the new route's nav band now (the table's
    // fallback rect; the live one follows at the re-read) so the disc is
    // already out from under an inset nav on the first painted frame.
    moon.avoid(routeLayout(path, { ...viewport }, mobile, {})?.navBand ?? null);

    sim.schedule(
      rereadAt,
      guard(id, () => {
        pending = resolveLayout(path);
        // §8: bodies never cross the moon disc. When an exiting lantern is
        // still rising across the glide path, the glide waits for the exit.
        const crosses =
          pending.moon !== null &&
          relayoutAt > sim!.state.ts &&
          moon.glideCrosses(
            pending.moon.centre,
            pending.moon.diameter,
            exitingBodies,
            ROUTE.risePx,
          );

        if (!crosses) {
          moon.enter(pending, sim!.state.ts);
          moonDone = true;
        }
      }),
    );
    sim.schedule(
      relayoutAt,
      guard(id, () => {
        applyLayout(pending ?? resolveLayout(path), 'route', moonDone);
        // §4.2: the enter's settle floor/ceiling count from the navigation.
        sim?.setSequenceStart(base);
        enterSequence('route', base);
      }),
    );
  }

  function onLaunch() {
    // The rocket's own <a href="/orbital"> click has usually started the
    // exit already through the document listener; this covers a launch
    // without one. Either way one exit runs.
    startExit(null);
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
              if (theme.nightTarget !== 1 || !sim) return;
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
      moon.setDim(y > dim.afterScrollY ? dim.to : 1, sim.state.ts, dim.ms);
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

  /**
   * Reduced motion runs no loop, so the §3.3 scroll-lift and the §0.16 moon
   * dim are applied as snaps from a passive scroll listener (§4.2: the same
   * rows with 0 ms).
   */
  function onReducedScroll() {
    if (!sim || !reduced) return;

    const y = window.scrollY;
    const lift = layout.scrollLift;
    let changed = false;

    if (lift && layout.lanterns.length) {
      const next = lifted
        ? y >= lift.returnBelowScrollY
        : y > lift.liftAtScrollY;

      if (next !== lifted) {
        lifted = next;
        sim.snapshotLift(lifted, lift.px);
        changed = true;
      }
    }

    const dim = layout.moonScrollDim;

    if (dim) {
      const target = y > dim.afterScrollY ? dim.to : 1;

      if (target !== moon.dimTarget) {
        moon.setDim(target, sim.state.ts, 0);
        changed = true;
      }
    }
    if (changed) render(0);
  }

  let reducedScrollAttached = false;

  function attachReducedScroll(on: boolean) {
    if (on === reducedScrollAttached) return;
    reducedScrollAttached = on;
    if (on)
      window.addEventListener('scroll', onReducedScroll, { passive: true });
    else window.removeEventListener('scroll', onReducedScroll);
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

  const loop = createLoop({
    hidden: () => document.hidden,
    addVisibilityListener: (fn) =>
      document.addEventListener('visibilitychange', fn),
    removeVisibilityListener: (fn) =>
      document.removeEventListener('visibilitychange', fn),
    raf: (fn) => requestAnimationFrame(fn),
    caf: (id) => cancelAnimationFrame(id),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    now: () => performance.now(),
    shouldPause,
    onFrame(nowMs) {
      if (disposed || !sim) return;

      const dt = wind.tick(nowMs);

      if (dt > 0) {
        sim.step(dt);
        stepScroll();
        advance(dt);
        render(dt);
      }
    },
    onPause: () => {
      overlayCheck = 0;
      wind.pause();
    },
    onResume: () => wind.resume(),
    minFrameGapMs: LOOP.minFrameGapMs,
    pollMs: PAUSE_POLL_MS,
  });

  /** Damps and tweens that live outside the sim. */
  function advance(dt: number) {
    if (!sim) return;

    const ts = sim.state.ts;

    theme.advance(dt, ts);
    moon.update(ts);

    const k = 1 - Math.exp(-PARALLAX_LAMBDA * dt);

    pointerDamped.x += (pointerTarget.x - pointerDamped.x) * k;
    pointerDamped.y += (pointerTarget.y - pointerDamped.y) * k;
    parallax.x = pointerDamped.x * PARALLAX_PX.x;
    parallax.y = pointerDamped.y * PARALLAX_PX.y;

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
    frame.night = theme.night;
    frame.moonNight = moon.night;
    frame.tints = theme.tints;
    frame.cameraZ = camera.position.z;
    frame.layout = layout;
    frame.mobile = mobile;
    frame.home = layout.home;

    lanterns.update(state.lanterns, layout.lanterns, frame);
    fall.update(state.fall, frame, tweenAt(floretFade, state.ts, 1));
    moonObjects.update(moon.state, frame);
    renderer.render(scene, camera);
    frames += 1;
    if (frames === 1) {
      // §4.1: the 200 ms canvas fade starts on the first painted frame, not
      // before the first shader compile (which could swallow the whole fade).
      canvas.style.opacity = '1';
    }

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

    const m = moon.state;
    const moonOn = m.visible && m.alpha > 0.001;
    const moonParallax = lightRules.moon.parallax;
    const v = pins.values;

    v.night = theme.night * sky;
    v.moonX = moonOn ? m.centre.x + parallax.x * moonParallax : null;
    v.moonY = moonOn ? m.centre.y + parallax.y * moonParallax : null;
    v.moonD = moonOn ? m.diameter : null;
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
    theme.snap();
    moon.snap(layout, theme.nightTarget);
    skyFade = null;
    floretFade = null;
    pointerTarget.x = pointerTarget.y = 0;
    pointerDamped.x = pointerDamped.y = 0;
    parallax.x = parallax.y = 0;
    lifted = false;
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
    // The page may already be scrolled (a post opened mid-article).
    attachReducedScroll(true);
    onReducedScroll();
  }

  function onReducedChange() {
    reduced = reducedQuery.matches;
    if (!sim) return;
    if (reduced) {
      loop.stop();
      pendingExit = null;
      renderReduced();
    } else {
      attachReducedScroll(false);
      setView({ reduced: false });
      loop.start();
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

    pointerTarget.x = clamp(xNorm, -1, 1);
    pointerTarget.y = clamp(yNorm, -1, 1);

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

  /** The pointer left the window: the parallax decays to rest (§4.5). */
  function onPointerLeave(event: PointerEvent) {
    if (event.relatedTarget === null) {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
    }
  }

  document.addEventListener('pointerout', onPointerLeave);

  function onTouch(event: TouchEvent) {
    if (reduced) return;

    const touch = event.touches[0];

    if (!touch) return;

    const point = { x: touch.clientX, y: touch.clientY };

    // The wind's gust and the sim's kick are one tap: both or neither (≤ 1 per 3 s).
    if (wind.touch(point, viewport)) sim?.tap(point);
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

    // The viewport may have changed during the fonts wait: re-resolve
    // unconditionally so the canvas never starts at the construction size.
    mobile = mobileQuery.matches;
    applySize();
    layout = resolveLayout(pathname);
    frame.layout = layout;
    frame.home = layout.home;
    frame.mobile = mobile;

    const instance = createSim({
      seed,
      layout,
      wind,
      night: theme.nightTarget,
      reducedMotion: reduced,
    });

    sim = instance;
    applyLayout(layout, 'mount');
    theme.snap();
    moon.setNight(theme.nightTarget, instance.state.ts);
    instance.prewarm(MOUNT.prewarmS);

    const ts = instance.state.ts;

    if (reduced) {
      renderReduced();

      return;
    }
    skyFade = tween(0, 1, ts, MOUNT.moonFadeMs);
    floretFade = tween(0, 1, ts, MOUNT.floretFadeMs);
    enterSequence('mount', ts);
    loop.start();
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
      frameMs: () => loop.frameMs(),
      layout: () => layout,
      time: () => wind.time(),
      state: () => sim?.state ?? null,
      view: () => view,
      moon: () => ({
        ...moon.state,
        centre: { ...moon.state.centre },
        night: moon.night,
        parallax: {
          x: parallax.x * lightRules.moon.parallax,
          y: parallax.y * lightRules.moon.parallax,
        },
      }),
      gusts: () => wind.gusts(),
      strip: () => shadowStrip?.userData ?? null,
    };

    (window as DebugWindow).__festival = api;
  }

  // ---- teardown --------------------------------------------------------------------
  function teardown() {
    if (torn) return;
    torn = true;
    loop.dispose();
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    themeObserver.disconnect();
    intersection?.disconnect();
    attachReducedScroll(false);
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('pointerout', onPointerLeave);
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
    moonObjects.dispose();
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
  // The runtime's identity is tied to the page load, not to props: a new
  // `posts` array (router.refresh, a revalidation, HMR of the root layout)
  // must not tear the WebGL runtime down and replay the mount. The runtime
  // reads `posts` through a ref that the data sentinel below refreshes on
  // commit; route changes arrive through the route sentinel.
  const postsRef = useRef(posts);

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
        posts: () => postsRef.current,
        pathname: canvas.ownerDocument.defaultView?.location.pathname ?? '/',
      });

      runtimeRef.current = runtime;
      onRuntime(runtime);

      return () => {
        runtime.dispose();
        runtimeRef.current = null;
        onRuntime(null);
      };
    },
    [seed, onRuntime],
  );

  /** A sentinel whose ref callback re-runs on every pathname change (§4.2). */
  const routeSentinel = useCallback(
    (element: HTMLElement | null) => {
      if (element) runtimeRef.current?.setRoute(pathname);
    },
    [pathname],
  );

  /** A sentinel whose ref callback re-runs whenever `posts` changes identity. */
  const dataSentinel = useCallback(
    (element: HTMLElement | null) => {
      if (element) postsRef.current = posts;
    },
    [posts],
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
      <span ref={dataSentinel} hidden />
    </>
  );
}
