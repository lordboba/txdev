/**
 * Per-route composition tables (bible §3, §3.8) and the resolver that scales
 * them to the live viewport.
 *
 * Tables are written in CSS px at 1440×900 (desktop) and 390×844 (mobile),
 * exactly as the bible draws them. The resolver does NOT scale proportionally:
 * every placed element carries a horizontal anchor, and its offset from that
 * anchor edge is preserved at any width.
 *
 *   'left' / 'right'                 the viewport edge (`/`, `/orbital`, mobile)
 *   'center'                         the viewport centre (centred H1s)
 *   'container-left' / '-right'      the copy column's edge on NavBar routes:
 *                                    Tailwind `max-w-*` centred containers,
 *                                    content width `min(maxWidth, w − 2·pad)`
 *
 * Vertical offsets are kept from the top. After anchoring, each lantern, slip,
 * text block and moon is clamped into the viewport (8 px margin) and dropped
 * if it would still enter the copy column or another exclusion rect: a page
 * with too little gutter loses that object rather than cheating it in.
 *
 * World space (§7.3): 1 world unit = 100 CSS px at z = 0, origin at the
 * viewport centre, +y up; a point at depth z projects with scale
 * `cameraZ / (cameraZ − z)`.
 */

import {
  festivalRoute,
  isMobileWidth,
  type FestivalRoute,
} from '../../../lib/festival.ts';

import { light } from '../palette.ts';
import {
  CHOREOGRAPHY,
  FESTIVAL_SELECTORS,
  PENDULUM,
  type CordAnchor,
  type FloretLayout,
  type LanternId,
  type LanternSpec,
  type MoonAnchor,
  type Rect,
  type RectLike,
  type RouteLayout,
  type TextLockup,
  type Vec2,
  type Viewport,
  type WorldPoint,
} from './types.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DESKTOP_BASE: Viewport = { w: 1440, h: 900 };
export const MOBILE_BASE: Viewport = { w: 390, h: 844 };
/** Paper height / paper width (§3, §5.1). */
export const PAPER_ASPECT = 0.86;
/** CSS px per world unit at z = 0 (§7.3). */
export const PX_PER_WORLD_UNIT = 100;
/** Camera vertical FOV, degrees (§7.3). */
export const CAMERA_FOV_DEG = 30;
/** Lantern bodies keep this many px below a nav band they sit under (§7.4). */
export const NAV_CLEARANCE_PX = 24;
/** Minimum distance from the viewport edge after clamping. */
export const EDGE_MARGIN_PX = 2;
/** Bodies may sit flush against the copy column (§3.5 B at x176); never inside. */
export const EXCLUSION_CLEARANCE_PX = 0;
/** Tassel length below the bottom collar, in body widths (cone 0.32 + gap 0.08). */
export const TASSEL_DROP_FACTOR = 0.4;
/** The slip hangs 14 px under the bottom collar (§6.A3). */
export const SLIP_GAP_PX = 14;
export const SLIP_SIZE = { w: 38, h: 152 } as const;
/**
 * The unfolded card hangs 8 px under the strip's foot, inside the gutter:
 * ≤ 28ch of Cormorant italic 19 px (236 px), never nearer than 8 px to the
 * copy column or the viewport edge; height allows a four-line clue and the
 * 谜底 line.
 */
export const CARD_GAP_PX = 8;
export const CARD_MAX_PX = 236;
export const CARD_HEIGHT_PX = 150;
export const CARD_CLEARANCE_PX = 8;
/**
 * The card hangs level from the strip's swinging foot (it counter-rotates
 * the strip's 0.8× θ), so it translates sideways with the foot: the 152 px
 * strip at 0.8 × 8.6° (a 2.2 gust) moves it ≈ 18 px. The column side is
 * inset by that much so the 8 px rule holds at the peak.
 */
export const CARD_SWING_INSET_PX = 18;

/** Tailwind container of each NavBar route: `max-w-*` minus `lg:px-8`. */
const CONTAINERS: Partial<
  Record<FestivalRoute, { maxWidth: number; pad: number }>
> = {
  '/blog': { maxWidth: 896, pad: 32 },
  '/blog/[slug]': { maxWidth: 896, pad: 32 },
  '/past-experience': { maxWidth: 1152, pad: 32 },
  '/schedule-a-call': { maxWidth: 1024, pad: 32 },
};

// ---------------------------------------------------------------------------
// Table types (inputs; builders consume the resolved RouteLayout instead)
// ---------------------------------------------------------------------------

export type HAnchor =
  | 'left'
  | 'right'
  | 'center'
  | 'container-left'
  | 'container-right';

export type Placed<T> = T & { anchor: HAnchor };

export type LanternEntry = Placed<{
  id: LanternId;
  hero: boolean;
  body: number;
  x: number;
  bodyTop: number;
  cord: CordAnchor;
  period: number;
  slip: boolean;
  tint: 0 | 1 | 2;
}>;

export type RectEntry =
  | { kind: 'rect'; rect: Rect; anchor: HAnchor; stretch?: 'right' | 'left' }
  | { kind: 'viewport'; top?: number; bottom?: number }
  | { kind: 'container'; top?: number; bottom?: number }
  | {
      kind: 'gutter';
      side: 'left' | 'right';
      clearance: number;
      top?: number;
      bottom?: number;
    }
  | { kind: 'nav-band'; pad: number; fallback: Rect; anchor: HAnchor }
  | { kind: 'element'; selector: string; fallback: Rect; anchor: HAnchor };

export type TextEntry = Placed<{ rect: Rect }>;

export interface RouteTable {
  zIndex: number;
  /** HTML overlay z when it must differ from `zIndex` (`/orbital`: 4). */
  overlayZIndex?: number;
  lanterns: LanternEntry[];
  moon: Placed<MoonAnchor> | null;
  florets: {
    count: number;
    emitters: RectEntry[];
    exclusions: RectEntry[];
    featherPx: number;
    alphaMax: number;
    alphaRampY: [number, number] | null;
    trackSelector: string | null;
  };
  text: {
    poem: TextEntry | null;
    colophon: TextEntry | null;
    colophonOrientation: 'vertical' | 'horizontal';
    translation: TextEntry | null;
    translationAlign: 'left' | 'right';
  };
  /** Rects lantern bodies and slips must not intersect (V8). */
  exclusions: RectEntry[];
  /** Rects the moon, poem, colophon and translation must not intersect. */
  textExclusions: RectEntry[];
  navBand: RectEntry | null;
  scrollLift: boolean;
  moonScrollDim: boolean;
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const VIEWPORT_TOP: CordAnchor = { kind: 'viewport-top' };
const NAV_BAND_FULL: RectEntry = {
  kind: 'nav-band',
  pad: 0,
  fallback: { x: 0, y: 0, w: 1440, h: 75 },
  anchor: 'left',
};
const NAV_BAND_INSET_1088: RectEntry = {
  kind: 'nav-band',
  pad: 0,
  fallback: { x: 176, y: 56, w: 1088, h: 75 },
  anchor: 'container-left',
};
const NAV_BAND_INSET_960: RectEntry = {
  kind: 'nav-band',
  pad: 0,
  fallback: { x: 240, y: 56, w: 960, h: 75 },
  anchor: 'container-left',
};
const COPY_COLUMN: RectEntry = { kind: 'container' };
const NO_TEXT: RouteTable['text'] = {
  poem: null,
  colophon: null,
  colophonOrientation: 'vertical',
  translation: null,
  translationAlign: 'right',
};
const NO_FLORETS: RouteTable['florets'] = {
  count: 0,
  emitters: [],
  exclusions: [],
  featherPx: 0,
  alphaMax: 1,
  alphaRampY: null,
  trackSelector: null,
};
const MOBILE_OFF: RouteTable = {
  zIndex: 1,
  lanterns: [],
  moon: null,
  florets: NO_FLORETS,
  text: NO_TEXT,
  exclusions: [],
  textExclusions: [],
  navBand: null,
  scrollLift: false,
  moonScrollDim: false,
};

function rect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Translation lockup: 17 px Cormorant italic, right-aligned to x1420. The
 * rendered line measures 261 px, so the rect is 262 wide (the earlier 230 px
 * estimate left 31 px of the line outside the rect V8 checks).
 */
const TRANSLATION_WIDTH_PX = 262;
const TRANSLATION_RIGHT = (y: number): TextEntry => ({
  rect: rect(1420 - TRANSLATION_WIDTH_PX, y, 1420, y + 17),
  anchor: 'container-right',
});
/** Florets keep this far from the moon disc and from the verse lockups. */
const MOON_FLORET_PAD_PX = 12;
const TEXT_FLORET_PAD_PX = 6;
/**
 * Florets keep this far from every lantern body and slip strip: band-0
 * instances sit at z 1.5, in front of the paper, and a 30 px ginkgo landing
 * on the hero drum read as a sticker over the title shadows. On a phone the
 * one lantern shares a 174 px block with the fall, so the pad is wider.
 */
const LANTERN_FLORET_PAD_PX = 6;
const LANTERN_FLORET_PAD_MOBILE_PX = 8;

// ---------------------------------------------------------------------------
// Desktop tables (§3.1–3.6)
// ---------------------------------------------------------------------------

const HOME: RouteTable = {
  zIndex: 2,
  lanterns: [
    {
      id: 'A',
      hero: true,
      body: 72,
      x: 1300,
      bodyTop: 120,
      cord: { kind: 'fixed-y', y: 64 },
      period: PENDULUM.periods.hero,
      slip: false,
      tint: 0,
      anchor: 'right',
    },
    {
      id: 'B',
      hero: false,
      body: 44,
      x: 1400,
      bodyTop: 104,
      cord: { kind: 'fixed-y', y: 64 },
      period: PENDULUM.periods.small,
      slip: false,
      tint: 1,
      anchor: 'right',
    },
  ],
  moon: null,
  florets: {
    count: 24,
    emitters: [
      { kind: 'rect', rect: rect(480, 64, 1440, 330), anchor: 'right' },
    ],
    exclusions: [
      { kind: 'rect', rect: rect(40, 88, 456, 370), anchor: 'left' },
      { kind: 'rect', rect: rect(1303, 0, 1400, 64), anchor: 'right' },
      // The signed placard rail (x510–1165 y120–185, + 6 px): a speck on
      // the Decagon wordmark reads as dirt on a sign, not 桂子 rain.
      { kind: 'rect', rect: rect(504, 114, 1171, 191), anchor: 'left' },
    ],
    featherPx: 0,
    alphaMax: light.homeFloretAlphaMax,
    alphaRampY: [280, 330],
    trackSelector: null,
  },
  text: {
    poem: null,
    // Two right-aligned lines (Han, then the mono label) so the block ends
    // at x1420 and never reaches the laptop screen (x ≤ 1205).
    colophon: { rect: rect(1270, 252, 1420, 276), anchor: 'right' },
    colophonOrientation: 'horizontal',
    translation: null,
    translationAlign: 'right',
  },
  exclusions: [
    {
      kind: 'rect',
      rect: rect(0, 0, 1440, 64),
      anchor: 'left',
      stretch: 'right',
    },
    { kind: 'rect', rect: rect(1303, 10, 1400, 54), anchor: 'right' },
    { kind: 'rect', rect: rect(40, 88, 456, 370), anchor: 'left' },
    { kind: 'rect', rect: rect(510, 120, 1165, 185), anchor: 'right' },
    { kind: 'rect', rect: rect(975, 290, 1440, 644), anchor: 'right' },
    {
      kind: 'rect',
      rect: rect(0, 644, 1440, 900),
      anchor: 'left',
      stretch: 'right',
    },
  ],
  textExclusions: [
    {
      kind: 'rect',
      rect: rect(0, 0, 1440, 64),
      anchor: 'left',
      stretch: 'right',
    },
    { kind: 'rect', rect: rect(40, 88, 456, 370), anchor: 'left' },
    { kind: 'rect', rect: rect(975, 290, 1440, 644), anchor: 'right' },
  ],
  navBand: null,
  scrollLift: false,
  moonScrollDim: false,
};

const ORBITAL: RouteTable = {
  zIndex: 2,
  // The canvas stays under `.orb-shell` (z 3); the moon button and the verse
  // must sit above it or the A5 hover never fires.
  overlayZIndex: 4,
  lanterns: [
    {
      id: 'C',
      hero: true,
      body: 64,
      x: 1330,
      bodyTop: 120,
      cord: {
        kind: 'element-bottom',
        selector: FESTIVAL_SELECTORS.toolsPill,
        fallbackY: 66,
      },
      period: PENDULUM.periods.hero,
      slip: false,
      tint: 0,
      anchor: 'right',
    },
    {
      id: 'A',
      hero: false,
      body: 56,
      x: 300,
      bodyTop: 66,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.mid,
      slip: false,
      tint: 1,
      anchor: 'left',
    },
  ],
  moon: { centre: { x: 160, y: 100 }, diameter: 120, anchor: 'left' },
  florets: {
    count: 30,
    emitters: [{ kind: 'viewport' }],
    // The H1 and the dek are transparent text over the layer (z 2 under
    // `.orb-shell`), so florets showed inside the letters; the mobile table
    // already keeps the band under the dek for the same reason (V10).
    exclusions: [
      // Down to the dek's top (y121): a fascicle in the 13 px gap between
      // the H1's baseline and the dek still read as "around the letters".
      { kind: 'rect', rect: rect(384, 34, 1056, 121), anchor: 'center' },
      {
        kind: 'element',
        selector: FESTIVAL_SELECTORS.orbitalDek,
        fallback: rect(455, 125, 985, 172),
        anchor: 'center',
      },
    ],
    featherPx: 0,
    alphaMax: 1,
    alphaRampY: null,
    trackSelector: null,
  },
  text: {
    poem: { rect: rect(128, 176, 150, 302), anchor: 'left' },
    colophon: { rect: rect(106, 176, 118, 272), anchor: 'left' },
    colophonOrientation: 'vertical',
    translation: {
      rect: rect(128, 314, 128 + TRANSLATION_WIDTH_PX, 330),
      anchor: 'left',
    },
    translationAlign: 'left',
  },
  exclusions: [
    { kind: 'rect', rect: rect(384, 34, 1056, 108), anchor: 'center' },
    {
      kind: 'element',
      selector: FESTIVAL_SELECTORS.toolsPill,
      fallback: rect(985, 28, 1412, 65),
      anchor: 'right',
    },
    { kind: 'rect', rect: rect(170, 200, 840, 880), anchor: 'left' },
    { kind: 'rect', rect: rect(964, 297, 1224, 763), anchor: 'right' },
    { kind: 'rect', rect: rect(28, 822, 207, 872), anchor: 'left' },
  ],
  // The translation may end over 1 px ring strokes (§3.2); the H1 and the
  // tools pill are the hard limits for the moon and the verse.
  textExclusions: [
    { kind: 'rect', rect: rect(384, 34, 1056, 108), anchor: 'center' },
    {
      kind: 'element',
      selector: FESTIVAL_SELECTORS.toolsPill,
      fallback: rect(985, 28, 1412, 65),
      anchor: 'right',
    },
    { kind: 'rect', rect: rect(28, 822, 207, 872), anchor: 'left' },
  ],
  navBand: null,
  scrollLift: false,
  moonScrollDim: false,
};

const BLOG: RouteTable = {
  zIndex: 1,
  lanterns: [
    {
      id: 'A',
      hero: true,
      body: 88,
      x: 96,
      bodyTop: 118,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.hero,
      slip: false,
      tint: 0,
      anchor: 'container-left',
    },
    {
      id: 'B',
      hero: false,
      body: 56,
      x: 214,
      bodyTop: 176,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.mid,
      slip: true,
      tint: 1,
      anchor: 'container-left',
    },
    {
      id: 'C',
      hero: false,
      // 56 px at x1385 (body x1357–1413): 27 px from the viewport edge so
      // the 2.8× halo and 3.2× pool are not cut by it (at x1395/60 the
      // right lantern read as cropped); the cord clears the disc by 42.
      body: 56,
      x: 1385,
      bodyTop: 196,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.small,
      slip: false,
      tint: 2,
      anchor: 'container-right',
    },
  ],
  moon: {
    // Disc x1193–1343: 57 px clear of the post card, 30 + 12 px from C's cord.
    centre: { x: 1268, y: 185 },
    diameter: 150,
    anchor: 'container-right',
  },
  florets: {
    count: 36,
    emitters: [
      { kind: 'gutter', side: 'left', clearance: 0, top: 75 },
      { kind: 'gutter', side: 'right', clearance: 0, top: 75 },
      // The top band ends above the JOURNAL eyebrow (y125–137): a floret on
      // the 'A' of JOURNAL is text under a festival object (§6.A).
      { kind: 'container', top: 75, bottom: 112 },
    ],
    exclusions: [
      {
        kind: 'rect',
        rect: rect(304, 158, 400, 206),
        anchor: 'container-left',
      },
    ],
    featherPx: 0,
    alphaMax: 1,
    alphaRampY: null,
    trackSelector: null,
  },
  text: {
    poem: { rect: rect(1178, 276, 1200, 402), anchor: 'container-right' },
    colophon: { rect: rect(1160, 276, 1172, 372), anchor: 'container-right' },
    colophonOrientation: 'vertical',
    translation: TRANSLATION_RIGHT(412),
    translationAlign: 'right',
  },
  exclusions: [
    NAV_BAND_FULL,
    COPY_COLUMN,
    { kind: 'rect', rect: rect(304, 158, 400, 206), anchor: 'container-left' },
    { kind: 'rect', rect: rect(304, 276, 1136, 488), anchor: 'container-left' },
  ],
  textExclusions: [
    NAV_BAND_FULL,
    { kind: 'rect', rect: rect(304, 158, 400, 206), anchor: 'container-left' },
    { kind: 'rect', rect: rect(304, 276, 1136, 488), anchor: 'container-left' },
  ],
  navBand: NAV_BAND_FULL,
  scrollLift: false,
  moonScrollDim: false,
};

const BLOG_SLUG: RouteTable = {
  ...BLOG,
  lanterns: BLOG.lanterns.map((lantern) => ({ ...lantern, slip: false })),
  // The breadcrumb links ('← All posts / Home') own the top band on a post:
  // gutters only; the count stays 36 and the gutters absorb them.
  florets: {
    ...BLOG.florets,
    emitters: BLOG.florets.emitters.filter((e) => e.kind !== 'container'),
  },
  exclusions: [NAV_BAND_FULL, COPY_COLUMN],
  textExclusions: [NAV_BAND_FULL],
  moonScrollDim: true,
};

const PAST_EXPERIENCE: RouteTable = {
  zIndex: 1,
  lanterns: [
    {
      id: 'A',
      hero: true,
      body: 72,
      x: 64,
      bodyTop: 112,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.hero,
      slip: false,
      tint: 0,
      anchor: 'container-left',
    },
    {
      id: 'B',
      hero: false,
      body: 52,
      // x138 (body x112–164, slip x119–157): 12 px clear of the container at
      // x176, so the slip's ±17 px gust swing never crosses the H1 or the
      // '← Back to home' bar (at x150 the body abutted the bar).
      x: 138,
      bodyTop: 210,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.mid,
      slip: true,
      tint: 1,
      anchor: 'container-left',
    },
  ],
  moon: {
    centre: { x: 1355, y: 155 },
    diameter: 130,
    anchor: 'container-right',
  },
  florets: {
    count: 30,
    emitters: [
      { kind: 'gutter', side: 'left', clearance: 0 },
      { kind: 'gutter', side: 'right', clearance: 0 },
    ],
    exclusions: [],
    featherPx: 0,
    alphaMax: 1,
    alphaRampY: null,
    trackSelector: null,
  },
  text: {
    poem: { rect: rect(1272, 240, 1294, 366), anchor: 'container-right' },
    colophon: { rect: rect(1254, 240, 1266, 336), anchor: 'container-right' },
    colophonOrientation: 'vertical',
    translation: TRANSLATION_RIGHT(378),
    translationAlign: 'right',
  },
  exclusions: [
    NAV_BAND_INSET_1088,
    COPY_COLUMN,
    { kind: 'rect', rect: rect(176, 277, 944, 397), anchor: 'container-left' },
  ],
  textExclusions: [
    NAV_BAND_INSET_1088,
    { kind: 'rect', rect: rect(176, 277, 944, 397), anchor: 'container-left' },
    { kind: 'rect', rect: rect(176, 470, 1264, 900), anchor: 'container-left' },
  ],
  navBand: NAV_BAND_INSET_1088,
  scrollLift: false,
  moonScrollDim: false,
};

const SCHEDULE_A_CALL: RouteTable = {
  zIndex: 1,
  lanterns: [
    {
      id: 'A',
      hero: true,
      body: 88,
      x: 92,
      bodyTop: 112,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.hero,
      slip: false,
      tint: 0,
      anchor: 'container-left',
    },
    {
      id: 'B',
      hero: false,
      body: 56,
      x: 196,
      bodyTop: 196,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.mid,
      slip: true,
      tint: 1,
      anchor: 'container-left',
    },
    {
      id: 'C',
      hero: false,
      // 52 px at x1396 (body x1370–1422): 18 px from the viewport edge so
      // the halo is whole (at x1410/56 it sat 2 px in and read as cropped);
      // the cord clears the disc by 31.
      body: 52,
      x: 1396,
      bodyTop: 240,
      cord: VIEWPORT_TOP,
      period: PENDULUM.periods.small,
      slip: false,
      tint: 2,
      anchor: 'container-right',
    },
  ],
  moon: {
    // Disc x1235–1365: 35 px right of the container edge at x1200.
    centre: { x: 1300, y: 155 },
    diameter: 130,
    anchor: 'container-right',
  },
  florets: {
    count: 30,
    emitters: [
      { kind: 'gutter', side: 'left', clearance: 8 },
      { kind: 'gutter', side: 'right', clearance: 8 },
    ],
    exclusions: [
      {
        kind: 'element',
        selector: FESTIVAL_SELECTORS.calendly,
        fallback: rect(241, 582, 1199, 1342),
        anchor: 'container-left',
      },
    ],
    featherPx: 24,
    alphaMax: 1,
    alphaRampY: null,
    trackSelector: null,
  },
  text: {
    poem: { rect: rect(1228, 240, 1250, 366), anchor: 'container-right' },
    colophon: { rect: rect(1210, 240, 1222, 336), anchor: 'container-right' },
    colophonOrientation: 'vertical',
    translation: TRANSLATION_RIGHT(378),
    translationAlign: 'right',
  },
  exclusions: [
    NAV_BAND_INSET_960,
    COPY_COLUMN,
    {
      kind: 'element',
      selector: FESTIVAL_SELECTORS.calendly,
      fallback: rect(241, 582, 1199, 1342),
      anchor: 'container-left',
    },
  ],
  textExclusions: [
    NAV_BAND_INSET_960,
    { kind: 'rect', rect: rect(240, 277, 944, 397), anchor: 'container-left' },
    {
      kind: 'element',
      selector: FESTIVAL_SELECTORS.calendly,
      fallback: rect(241, 582, 1199, 1342),
      anchor: 'container-left',
    },
  ],
  navBand: NAV_BAND_INSET_960,
  scrollLift: false,
  moonScrollDim: false,
};

// ---------------------------------------------------------------------------
// Mobile tables (390×844; §3.1–3.6 "Mobile")
// ---------------------------------------------------------------------------

const HOME_MOBILE: RouteTable = {
  ...MOBILE_OFF,
  zIndex: 1,
  florets: {
    count: 10,
    emitters: [
      {
        kind: 'element',
        selector: FESTIVAL_SELECTORS.benchCanvas,
        fallback: rect(0, 213, 390, 567),
        anchor: 'left',
        // stretch handled by the live rect
      },
    ],
    exclusions: [],
    featherPx: 0,
    alphaMax: light.homeFloretAlphaMax,
    alphaRampY: null,
    trackSelector: FESTIVAL_SELECTORS.benchCanvas,
  },
};

const ORBITAL_MOBILE: RouteTable = {
  ...MOBILE_OFF,
  zIndex: 2,
  // The H1 (y16–135) and dek (y148–195) are transparent text over the layer
  // (z 2 under `.orb-shell`), so florets showed through the letters (V10).
  // The band starts under the dek; the rings and the index still get the fall.
  florets: {
    ...NO_FLORETS,
    count: 12,
    emitters: [
      {
        kind: 'rect',
        rect: rect(0, 216, 390, 844),
        anchor: 'left',
        stretch: 'right',
      },
    ],
    featherPx: 8,
  },
};

const MOBILE_NAV_BAND: RectEntry = {
  kind: 'nav-band',
  pad: 0,
  fallback: { x: 0, y: 0, w: 390, h: 62 },
  anchor: 'left',
};

const BLOG_MOBILE: RouteTable = {
  ...MOBILE_OFF,
  lanterns: [
    {
      id: 'A',
      hero: false,
      body: 44,
      x: 335,
      bodyTop: 74,
      cord: { kind: 'nav-bottom', fallbackY: 62 },
      period: PENDULUM.periods.small,
      slip: false,
      tint: 0,
      anchor: 'right',
    },
  ],
  // Six florets, florets only (sim.ts `buildSpeciesTable`): twelve with
  // leaves and ginkgo in a 174×78 px block beside a 44 px lantern read as a
  // sticker clump, and the fall keeps 8 px off the lantern (see
  // `LANTERN_FLORET_PAD_MOBILE_PX`).
  florets: {
    ...NO_FLORETS,
    count: 6,
    emitters: [
      { kind: 'rect', rect: rect(200, 62, 374, 140), anchor: 'right' },
    ],
  },
  exclusions: [
    MOBILE_NAV_BAND,
    {
      kind: 'rect',
      rect: rect(16, 140, 374, 844),
      anchor: 'left',
      stretch: 'right',
    },
  ],
  textExclusions: [],
  navBand: MOBILE_NAV_BAND,
  scrollLift: true,
};

const TABLES: Record<
  FestivalRoute,
  { desktop: RouteTable; mobile: RouteTable }
> = {
  '/': { desktop: HOME, mobile: HOME_MOBILE },
  '/orbital': { desktop: ORBITAL, mobile: ORBITAL_MOBILE },
  '/blog': { desktop: BLOG, mobile: BLOG_MOBILE },
  '/blog/[slug]': { desktop: BLOG_SLUG, mobile: BLOG_MOBILE },
  '/past-experience': { desktop: PAST_EXPERIENCE, mobile: MOBILE_OFF },
  '/schedule-a-call': { desktop: SCHEDULE_A_CALL, mobile: MOBILE_OFF },
};

/** Riddle pools and route seeds (§6.A3). */
const RIDDLES: Record<
  FestivalRoute,
  { pool: 'project' | 'post' | null; seed: number }
> = {
  '/': { pool: null, seed: 0 },
  '/orbital': { pool: null, seed: 0 },
  '/blog': { pool: 'post', seed: 0 },
  '/blog/[slug]': { pool: null, seed: 0 },
  '/past-experience': { pool: 'project', seed: 0 },
  '/schedule-a-call': { pool: 'project', seed: 5 },
};

/** The raw table for a route, for tests and the gauntlet. */
export function routeTable(route: FestivalRoute, mobile: boolean): RouteTable {
  return mobile ? TABLES[route].mobile : TABLES[route].desktop;
}

// ---------------------------------------------------------------------------
// Live rects the resolver may be handed
// ---------------------------------------------------------------------------

export interface LiveRects {
  /** `header.sticky` bounding rect (null when the route has no nav band). */
  nav?: RectLike | null;
  /** Any selector-keyed rects (`.orb-hero-tools`, `main canvas`, `iframe`). */
  elements?: Record<string, RectLike | null | undefined>;
}

export function fromRectLike(r: RectLike): Rect {
  return { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top };
}

/** Reads the live rects the tables reference. Browser only. */
export function readLiveRects(root: Document = document): LiveRects {
  const nav = root.querySelector(FESTIVAL_SELECTORS.nav);
  const elements: Record<string, RectLike | null> = {};

  for (const selector of [
    FESTIVAL_SELECTORS.toolsPill,
    FESTIVAL_SELECTORS.orbitalDek,
    FESTIVAL_SELECTORS.benchCanvas,
    FESTIVAL_SELECTORS.calendly,
  ]) {
    elements[selector] =
      root.querySelector(selector)?.getBoundingClientRect() ?? null;
  }

  return { nav: nav?.getBoundingClientRect() ?? null, elements };
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

type Frame = {
  viewport: Viewport;
  base: Viewport;
  container: { left: number; right: number } | null;
  baseContainer: { left: number; right: number } | null;
};

function containerEdges(
  route: FestivalRoute,
  viewport: Viewport,
): { left: number; right: number } | null {
  const container = CONTAINERS[route];

  if (!container) return null;

  const width = Math.min(container.maxWidth, viewport.w) - 2 * container.pad;
  const left = (viewport.w - width) / 2;

  return { left, right: left + width };
}

function anchorX(x: number, anchor: HAnchor, frame: Frame): number {
  switch (anchor) {
    case 'left':
      return x;
    case 'right':
      return x + (frame.viewport.w - frame.base.w);
    case 'center':
      return x + (frame.viewport.w - frame.base.w) / 2;
    case 'container-left':
      return frame.container && frame.baseContainer
        ? x - frame.baseContainer.left + frame.container.left
        : x;
    case 'container-right':
      return frame.container && frame.baseContainer
        ? x - frame.baseContainer.right + frame.container.right
        : x + (frame.viewport.w - frame.base.w);
  }
}

function anchorRect(
  r: Rect,
  anchor: HAnchor,
  frame: Frame,
  stretch?: 'right' | 'left',
): Rect {
  const x = anchorX(r.x, anchor, frame);

  if (stretch === 'right')
    return { x, y: r.y, w: frame.viewport.w - x, h: r.h };
  if (stretch === 'left') {
    const right = anchorX(r.x + r.w, anchor, frame);

    return { x: 0, y: r.y, w: right, h: r.h };
  }

  return { x, y: r.y, w: r.w, h: r.h };
}

function resolveRectEntry(
  entry: RectEntry,
  frame: Frame,
  live: LiveRects,
): Rect | null {
  const { viewport, container } = frame;

  switch (entry.kind) {
    case 'rect':
      return anchorRect(entry.rect, entry.anchor, frame, entry.stretch);
    case 'viewport': {
      const top = entry.top ?? 0;
      const bottom = entry.bottom ?? viewport.h;

      return { x: 0, y: top, w: viewport.w, h: bottom - top };
    }
    case 'container': {
      const top = entry.top ?? 0;
      const bottom = entry.bottom ?? viewport.h;
      const edges = container ?? { left: 0, right: viewport.w };

      return {
        x: edges.left,
        y: top,
        w: edges.right - edges.left,
        h: bottom - top,
      };
    }
    case 'gutter': {
      const top = entry.top ?? 0;
      const bottom = entry.bottom ?? viewport.h;
      const edges = container ?? { left: 0, right: viewport.w };
      const x1 = entry.side === 'left' ? 0 : edges.right + entry.clearance;
      const x2 =
        entry.side === 'left' ? edges.left - entry.clearance : viewport.w;

      return x2 - x1 > 0
        ? { x: x1, y: top, w: x2 - x1, h: bottom - top }
        : null;
    }
    case 'nav-band': {
      const r = live.nav
        ? fromRectLike(live.nav)
        : anchorRect(entry.fallback, entry.anchor, frame);

      return { x: r.x, y: r.y, w: r.w, h: r.h + entry.pad };
    }
    case 'element': {
      const found = live.elements?.[entry.selector];

      return found
        ? fromRectLike(found)
        : anchorRect(entry.fallback, entry.anchor, frame);
    }
  }
}

export function rectsIntersect(a: Rect, b: Rect, clearance = 0): boolean {
  return (
    a.x < b.x + b.w + clearance &&
    a.x + a.w > b.x - clearance &&
    a.y < b.y + b.h + clearance &&
    a.y + a.h > b.y - clearance
  );
}

function insideViewport(r: Rect, viewport: Viewport, margin: number): boolean {
  return (
    r.x >= margin &&
    r.y >= 0 &&
    r.x + r.w <= viewport.w - margin &&
    r.y + r.h <= viewport.h
  );
}

/** Shifts `r` horizontally into the viewport with `margin`; never vertically. */
function clampX(r: Rect, viewport: Viewport, margin: number): Rect {
  const minX = margin;
  const maxX = viewport.w - margin - r.w;

  if (maxX < minX) return r;

  return { ...r, x: Math.min(Math.max(r.x, minX), maxX) };
}

function clear(
  r: Rect,
  exclusions: readonly Rect[],
  clearance: number,
): boolean {
  return exclusions.every((e) => !rectsIntersect(r, e, clearance));
}

function resolveCordAnchorY(cord: CordAnchor, live: LiveRects): number {
  switch (cord.kind) {
    case 'viewport-top':
      return 0;
    case 'fixed-y':
      return cord.y;
    case 'nav-bottom':
      return live.nav?.bottom ?? cord.fallbackY;
    case 'element-bottom':
      return live.elements?.[cord.selector]?.bottom ?? cord.fallbackY;
  }
}

/**
 * The full extent a lantern must keep clear: paper body plus the collars,
 * the tassel below and the cord above are checked separately (cords may
 * cross the nav band: they read as going up into the eaves).
 */
/** Paper height for a body width, rounded to whole px as the bible tables are. */
export function paperHeight(body: number): number {
  return Math.round(body * PAPER_ASPECT);
}

function lanternClearanceRect(body: Rect, bodyWidth: number): Rect {
  const tassel = bodyWidth * TASSEL_DROP_FACTOR;

  return { x: body.x, y: body.y, w: body.w, h: body.h + tassel };
}

function resolveLantern(
  entry: LanternEntry,
  frame: Frame,
  live: LiveRects,
  exclusions: readonly Rect[],
  navBand: Rect | null,
  order: number,
): LanternSpec | null {
  const { viewport } = frame;
  const bodyHeight = paperHeight(entry.body);
  let x = anchorX(entry.x, entry.anchor, frame);
  let bodyRect: Rect = {
    x: x - entry.body / 2,
    y: entry.bodyTop,
    w: entry.body,
    h: bodyHeight,
  };

  bodyRect = clampX(bodyRect, viewport, EDGE_MARGIN_PX);
  x = bodyRect.x + entry.body / 2;

  // Bodies under a nav band keep NAV_CLEARANCE_PX below it (§7.4). The mobile
  // `/blog` table hangs 12 px under the nav on purpose; the rule only pushes.
  if (navBand && navBand.w > 0) {
    const horizontallyUnderNav =
      bodyRect.x < navBand.x + navBand.w && bodyRect.x + bodyRect.w > navBand.x;
    const floor =
      navBand.y +
      navBand.h +
      (frame.base === MOBILE_BASE ? 12 : NAV_CLEARANCE_PX);

    if (horizontallyUnderNav && bodyRect.y < floor) {
      bodyRect = { ...bodyRect, y: floor };
    }
  }

  const clearanceRect = lanternClearanceRect(bodyRect, entry.body);

  if (
    !insideViewport(clearanceRect, viewport, EDGE_MARGIN_PX) ||
    !clear(clearanceRect, exclusions, EXCLUSION_CLEARANCE_PX)
  ) {
    return null;
  }

  const cordAnchorY = resolveCordAnchorY(entry.cord, live);
  let slipRect: Rect | null = null;
  let cardRect: Rect | null = null;

  if (entry.slip) {
    slipRect = {
      x: x - SLIP_SIZE.w / 2,
      y: bodyRect.y + bodyRect.h + SLIP_GAP_PX,
      w: SLIP_SIZE.w,
      h: SLIP_SIZE.h,
    };
    if (
      !insideViewport(slipRect, viewport, EDGE_MARGIN_PX) ||
      !clear(slipRect, exclusions, EXCLUSION_CLEARANCE_PX)
    ) {
      slipRect = null;
    }
  }
  if (slipRect) {
    cardRect = resolveCard(slipRect, frame, exclusions);
    // A slip whose card has nowhere to unfold is not hung at all.
    if (!cardRect) slipRect = null;
  }

  return {
    id: entry.id,
    hero: entry.hero,
    body: entry.body,
    x,
    bodyRect,
    cord: entry.cord,
    cordAnchorY,
    cordLengthPx: Math.max(0, bodyRect.y - cordAnchorY),
    period: entry.period,
    slip: entry.slip && slipRect !== null,
    slipRect,
    cardRect,
    tint: entry.tint,
    order,
    z: entry.hero ? 0.2 : -0.1 * order,
  };
}

/**
 * The riddle card under a slip: centred on the strip, then shifted into the
 * gutter (between the viewport edge and the copy column: 8 px clear of the
 * edge, 8 + 18 px clear of the column so a gust's swing never reaches it)
 * and narrowed to the gutter when 28ch does not fit; dropped when it still
 * meets an exclusion rect (H1, nav, Calendly).
 */
function resolveCard(
  slip: Rect,
  frame: Frame,
  exclusions: readonly Rect[],
): Rect | null {
  const { viewport, container } = frame;
  const centre = slip.x + slip.w / 2;
  const onLeft = !container || centre < viewport.w / 2;
  const columnSide = CARD_CLEARANCE_PX + CARD_SWING_INSET_PX;
  const lo = onLeft ? CARD_CLEARANCE_PX : (container?.right ?? 0) + columnSide;
  const hi = onLeft
    ? (container?.left ?? viewport.w) - columnSide
    : viewport.w - CARD_CLEARANCE_PX;
  const w = Math.min(CARD_MAX_PX, hi - lo);

  if (w < 120) return null;

  const x = Math.min(Math.max(centre - w / 2, lo), hi - w);
  const card: Rect = {
    x,
    y: slip.y + slip.h + CARD_GAP_PX,
    w,
    h: CARD_HEIGHT_PX,
  };

  return insideViewport(card, viewport, 0) &&
    clear(card, exclusions, EXCLUSION_CLEARANCE_PX)
    ? card
    : null;
}

function resolveText(
  entry: TextEntry | null,
  frame: Frame,
  exclusions: readonly Rect[],
): Rect | null {
  if (!entry) return null;

  const placed = clampX(
    anchorRect(entry.rect, entry.anchor, frame),
    frame.viewport,
    EDGE_MARGIN_PX,
  );

  return insideViewport(placed, frame.viewport, EDGE_MARGIN_PX) &&
    clear(placed, exclusions, EXCLUSION_CLEARANCE_PX)
    ? placed
    : null;
}

function resolveMoon(
  moon: Placed<MoonAnchor> | null,
  frame: Frame,
  exclusions: readonly Rect[],
): MoonAnchor | null {
  if (!moon) return null;

  const r = moon.diameter / 2;
  const disc = clampX(
    {
      x: anchorX(moon.centre.x, moon.anchor, frame) - r,
      y: moon.centre.y - r,
      w: moon.diameter,
      h: moon.diameter,
    },
    frame.viewport,
    EDGE_MARGIN_PX,
  );

  if (
    !insideViewport(disc, frame.viewport, EDGE_MARGIN_PX) ||
    !clear(disc, exclusions, EXCLUSION_CLEARANCE_PX)
  ) {
    return null;
  }

  return { centre: { x: disc.x + r, y: disc.y + r }, diameter: moon.diameter };
}

function padRect(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad };
}

/** The moon's disc as a rect. */
export function moonDisc(moon: MoonAnchor): Rect {
  const r = moon.diameter / 2;

  return {
    x: moon.centre.x - r,
    y: moon.centre.y - r,
    w: moon.diameter,
    h: moon.diameter,
  };
}

/** Every cord x must be ≥ 30 px outside the moon disc (§8). */
export function cordClearsMoon(
  spec: LanternSpec,
  moon: MoonAnchor | null,
): boolean {
  if (!moon) return true;

  return Math.abs(spec.x - moon.centre.x) >= moon.diameter / 2 + 30;
}

/**
 * Resolves the composition for a pathname on a live viewport. Returns `null`
 * when the route is outside the allow-list. `mobile` defaults to the Bench
 * threshold (`max-width: 700px`); pass the `matchMedia` result when you have it.
 */
export function routeLayout(
  pathname: string,
  viewport: Viewport,
  mobile: boolean = isMobileWidth(viewport.w),
  live: LiveRects = {},
): RouteLayout | null {
  const route = festivalRoute(pathname);

  if (!route) return null;

  const table = routeTable(route, mobile);
  const base = mobile ? MOBILE_BASE : DESKTOP_BASE;
  const frame: Frame = {
    viewport,
    base,
    container: mobile ? null : containerEdges(route, viewport),
    baseContainer: mobile ? null : containerEdges(route, base),
  };

  const navBand = table.navBand
    ? resolveRectEntry(table.navBand, frame, live)
    : null;
  const resolveAll = (entries: readonly RectEntry[]) =>
    entries
      .map((entry) => resolveRectEntry(entry, frame, live))
      .filter((r): r is Rect => r !== null);
  const exclusions = resolveAll(table.exclusions);
  const textExclusions = resolveAll(table.textExclusions);

  // Moon first: a lantern whose cord would cross the disc is dropped (§0.4).
  const moon = resolveMoon(table.moon, frame, textExclusions);

  const hero = table.lanterns.find((l) => l.hero);
  const ordered = [
    ...(hero ? [hero] : []),
    ...table.lanterns
      .filter((l) => !l.hero)
      .sort(
        (a, b) => anchorX(a.x, a.anchor, frame) - anchorX(b.x, b.anchor, frame),
      ),
  ];
  const lanterns = ordered
    .map((entry, order) =>
      resolveLantern(entry, frame, live, exclusions, navBand, order),
    )
    .filter(
      (spec): spec is LanternSpec =>
        spec !== null && cordClearsMoon(spec, moon),
    )
    .map((spec, order) => ({ ...spec, order }));

  // Verse belongs to moon pages only; `/` has no moon and a horizontal colophon.
  const verseAllowed = table.moon === null || moon !== null;
  const poem = verseAllowed
    ? resolveText(table.text.poem, frame, textExclusions)
    : null;
  const text: TextLockup = {
    poem,
    colophon: verseAllowed
      ? resolveText(table.text.colophon, frame, textExclusions)
      : null,
    colophonOrientation: table.text.colophonOrientation,
    translation: poem
      ? resolveText(table.text.translation, frame, textExclusions)
      : null,
    translationAlign: table.text.translationAlign,
  };

  // Florets never cross the moon disc (a floret on the 0.8-Y disc reads as
  // dirt, not 桂子 rain), the verse, colophon and translation (they showed
  // through the 55–70% ink), or a lantern body and its slip (a leaf on the
  // drum is a sticker, not a leaf passing); `fieldAlpha()` fades them out
  // over these rects, so the fall passes beside the objects.
  const lanternPad = mobile
    ? LANTERN_FLORET_PAD_MOBILE_PX
    : LANTERN_FLORET_PAD_PX;
  const floretExclusions = [
    ...table.florets.exclusions
      .map((entry) => resolveRectEntry(entry, frame, live))
      .filter((r): r is Rect => r !== null),
    ...(moon ? [padRect(moonDisc(moon), MOON_FLORET_PAD_PX)] : []),
    ...[text.poem, text.colophon, text.translation]
      .filter((r): r is Rect => r !== null)
      .map((r) => padRect(r, TEXT_FLORET_PAD_PX)),
    ...lanterns.flatMap((l) => [
      padRect(l.bodyRect, lanternPad),
      ...(l.slipRect ? [padRect(l.slipRect, LANTERN_FLORET_PAD_PX)] : []),
    ]),
  ];
  const florets: FloretLayout = {
    count: table.florets.count,
    emitters: table.florets.emitters
      .map((entry) => resolveRectEntry(entry, frame, live))
      .filter((r): r is Rect => r !== null && r.w > 0 && r.h > 0),
    exclusions: floretExclusions,
    featherPx: table.florets.featherPx,
    alphaMax: table.florets.alphaMax,
    alphaRampY: table.florets.alphaRampY,
    trackSelector: table.florets.trackSelector,
  };

  const home = route === '/';

  return {
    route,
    viewport,
    mobile,
    home,
    zIndex: table.zIndex,
    overlayZIndex: table.overlayZIndex ?? table.zIndex,
    lanterns,
    moon,
    florets: florets.emitters.length ? florets : { ...florets, count: 0 },
    text,
    exclusions,
    textExclusions,
    navBottom: navBand ? navBand.y + navBand.h : 0,
    navBand,
    halo: !home,
    poolPeak: home ? light.pool.peakHome : light.pool.peakDark,
    ignoresTheme: home,
    scrollLift: table.scrollLift ? CHOREOGRAPHY.mobileScrollLift : null,
    moonScrollDim: table.moonScrollDim
      ? {
          afterScrollY: light.moon.scrollDimAfterPx,
          to: light.moon.scrollDimTo,
          ms: light.moon.scrollDimMs,
        }
      : null,
    riddlePool: lanterns.some((l) => l.slip) ? RIDDLES[route].pool : null,
    routeSeed: RIDDLES[route].seed,
  };
}

// ---------------------------------------------------------------------------
// px ↔ world (§7.3)
// ---------------------------------------------------------------------------

/** Camera z for a viewport height: `h / 100 / 2 / tan(fov / 2)` (16.79 at 900). */
export function cameraZ(viewportHeight: number): number {
  return (
    viewportHeight /
    PX_PER_WORLD_UNIT /
    2 /
    Math.tan((CAMERA_FOV_DEG / 2) * (Math.PI / 180))
  );
}

/** World units per CSS px at depth z (1/100 at z = 0; larger further away). */
export function worldPerPx(z: number, viewportHeight: number): number {
  const cz = cameraZ(viewportHeight);

  return (cz - z) / cz / PX_PER_WORLD_UNIT;
}

/** CSS px (top-left origin) → world point at depth z. */
export function pxToWorld(
  p: Vec2,
  viewport: Viewport,
  z = 0,
  out: WorldPoint = { x: 0, y: 0, z },
): WorldPoint {
  const k = worldPerPx(z, viewport.h);

  out.x = (p.x - viewport.w / 2) * k;
  out.y = (viewport.h / 2 - p.y) * k;
  out.z = z;

  return out;
}

/** World point → CSS px (top-left origin), using the point's own z. */
export function worldToPx(
  p: WorldPoint,
  viewport: Viewport,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const k = worldPerPx(p.z, viewport.h);

  out.x = viewport.w / 2 + p.x / k;
  out.y = viewport.h / 2 - p.y / k;

  return out;
}

/** A px length → world units at depth z. */
export function pxLengthToWorld(
  px: number,
  z: number,
  viewport: Viewport,
): number {
  return px * worldPerPx(z, viewport.h);
}

/** Pendulum stiffness `g' = 4π²L/T²` for a drawn cord length L (world) (§4.5). */
export function pendulumGravity(
  cordLengthWorld: number,
  periodS: number,
): number {
  return (4 * Math.PI * Math.PI * cordLengthWorld) / (periodS * periodS);
}
