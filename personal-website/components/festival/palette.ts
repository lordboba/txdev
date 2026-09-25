/**
 * Mid-Autumn palette: every constant of bible §2.1, the light/alpha numbers of
 * §2.2, and the OKLCH hue gate that decides whether the page accent may tint
 * the pool and halo. THREE-free on purpose: `sim.ts` and the node tests import
 * it, and builders convert once with `hexToRgb01()` where a shader needs it.
 *
 * Physical colours (paper, candle, bamboo, moon, tassel, the 银朱 seal) never
 * change with the theme; only the page-side tints (pool, halo, slip underline)
 * follow the live `--accent`, and only when its OKLCH hue lies inside the gate.
 */

export type Hex = `#${string}`;
/** Numeric RGB, each channel 0..1 (sRGB-encoded, not linear). */
export type Rgb01 = readonly [number, number, number];

/** Festival constants (§2.1). Two-stop rows expose `from`/`to`. */
export const palette = {
  /** 宣纸 warm paper: albedo when unlit (light theme; exit-dim). */
  paperUnlit: '#e9dcc4',
  /** 姜黄: lit paper where it thins toward the caps. */
  paperEdge: '#ffc773',
  /** 藤黄 gamboge: lit paper mid-tone. */
  paperMid: '#ffb61e',
  /** 杏黄: candle-height band. */
  paperHot: '#ffa631',
  /** Candle core: brightest paper value; must stay below the moon. */
  paperCore: '#ffd58a',
  /** 赭 ochre: dark scalloped rim where paper turns away, to the limb. */
  paperRim: { from: '#9c5333', to: '#7a3d1a' },
  /** Bamboo, stained: 16 meridians, 45% darkening of lit paper. */
  rib: '#5a3a22',
  /** 漆黑 lacquer: top and bottom collars. */
  cap: '#161823',
  /** 栗色 chestnut: 1 px chamfer band on each collar. */
  capChamfer: '#60281e',
  /** Hook ring. */
  brass: '#b08d57',
  /** 2 px cord, catenary. */
  cord: { dark: '#2a1f18', light: '#4a3a2c' },
  /** 银朱 vermilion: the only red on the page, to the tips. */
  tassel: { from: '#bf242a', to: '#8f1c22' },
  /** 胭脂 rouge: tassel knot. */
  knot: '#9d2933',
  /** 象牙白: lit disc base under the maria map. */
  moonBody: '#fffbf0',
  /** 月白 moon-white: limb tint, halo, poem ink. */
  moonRim: '#d6ecf0',
  /** 霜色: outer halo; floret cool mix target. */
  frost: '#e9f1f6',
  /** 黛蓝: 12% CSS radial tint within 2.2 moon diameters (dark only). */
  nightNearMoon: '#425066',
  /** 缃色: 金桂 florets (80%). */
  floretGold: '#f0c239',
  /** 银桂 florets (15%). */
  floretIvory: '#fff6dc',
  /** 橘黄: 丹桂 florets (5%). */
  floretOrange: '#ff8936',
  /** 竹青: osmanthus leaf, top / underside. */
  leafGreen: { top: '#789262', underside: '#8fa37a' },
  /** 枯黄 / 竹青: late-September ginkgo, `from` blended 40–70% with `to`. */
  ginkgo: { from: '#d3b17d', to: '#9aa66f' },
  /** 墨色: riddle slip text, primary / secondary (both ≥ 7:1 on slip paper). */
  ink: { primary: '#2b241c', secondary: '#3d4a54' },
  /** Riddle slip and unfolded card. */
  slipPaper: '#efe4cf',
  /** 1 px slip edge. */
  slipEdge: '#d9cbb0',
} as const;

export type PaletteName = keyof typeof palette;

/** Site tokens the festival reads unchanged (§2.1 first table). */
export const siteTokens = {
  background: { dark: '#12100d', light: '#f5f1e9' },
  foreground: { dark: '#f4ecdf', light: '#12100d' },
  accent: { dark: '#c89b52', light: '#a57b37' },
  /** Bench `--ink` (`Bench.module.css`), used for the `/` colophon at 75%. */
  benchInk: '#141517',
  /** The Bench set is this grey in both themes; `/` ignores `data-theme`. */
  benchSet: '#c8c8c8',
} as const;

/** Three paper tints for `aTint`, no two lanterns match (§5.1). */
export const paperTints: readonly [Hex, Hex, Hex] = [
  '#ffb61e',
  '#ffb020',
  '#ffbd2e',
];

/** Species colour mix for florets: gold 80%, ivory 15%, orange 5% (§2.3). */
export const floretSpeciesMix = [
  { color: palette.floretGold, weight: 0.8 },
  { color: palette.floretIvory, weight: 0.15 },
  { color: palette.floretOrange, weight: 0.05 },
] as const;

/** Light and alpha numbers (§2.2, §2.3, §3.1, §5.3). Dimensionless. */
export const light = {
  /** Halo: additive billboard under the paper. */
  halo: { widthFactor: 2.8, falloffPow: 2.4, peakDark: 0.35, peakLight: 0 },
  /**
   * Pool: NormalBlending ellipse on the page at lantern z − 0.2. On the grey
   * Bench set (`/`) it is the only light cue, so it peaks at 0.22 in the
   * saturated `paperHot` (a grey wall needs chroma, not just alpha).
   */
  pool: {
    widthFactor: 3.2,
    aspect: 1.35,
    centreDropBodyHeights: 0.4,
    falloffPow: 2.0,
    peakDark: 0.14,
    peakHome: 0.22,
    homeTint: palette.paperHot,
    peakLight: 0,
    zOffset: -0.2,
    /** Sampled at the nearest copy-column edge on every route (V2). */
    maxAlphaAtColumnEdge: 0.02,
  },
  moon: {
    limbPow: 0.35,
    halo: {
      diameterFactor: 2.2,
      falloffPow: 2.6,
      peakDark: 0.18,
      peakLight: 0,
    },
    haloBreathAmplitude: 0.03,
    haloBreathPeriodS: 11,
    lightDiscAlpha: 0.07,
    lightMariaAlpha: 0.03,
    /** `/blog/[slug]`: past this scrollY the moon dims to `scrollDimTo`. */
    scrollDimAfterPx: 400,
    scrollDimTo: 0.6,
    scrollDimMs: 400,
    z: -3,
    parallax: 0.85,
  },
  /** CSS radial tint near the moon, dark only. */
  skyTint: { alpha: 0.12, radiusDiameters: 1.1 },
  /** Paper shader terms (§2.2). */
  paper: {
    throughPow: 1.35,
    candleBand: 0.62,
    candleY: 0.05,
    coreMix: 0.55,
    ribDarken: 0.45,
    ribInner: 0.012,
    ribOuter: 0.035,
    ribCount: 16,
    fibreStrength: 0.06,
    unlitRibDarken: 0.12,
    /** 走马灯: lit paper darkens by this much under a full shadow texel. */
    shadowDarken: 0.5,
    /**
     * One drum circumference reads this fraction of the 4096 px strip: a
     * 49 px cap advance (76 px Cormorant) becomes 22 px on the 88 px hero.
     */
    shadowCircumferenceFraction: 0.15,
  },
  /** Candle flicker: `1 + 0.06·(noise(7t) + 0.5·noise(13t))`, floor 0.94. */
  candle: { amplitude: 0.06, floor: 0.94, hz1: 7, hz2: 13 },
  /** Florets: cool mix toward `frost` by moon proximity (§2.3). */
  floret: { coolMix: 0.45, coolSmoothstep: [0.35, 0.9] as const },
  /** `/` only: florets ≤ 0.6 alpha, ramped out between these y values. */
  homeFloretAlphaMax: 0.6,
} as const;

/** OKLCH hue gate for page-side tints (§2.1): accent hue ∈ [55°, 95°]. */
export const ACCENT_HUE_GATE: readonly [number, number] = [55, 95];
export const POOL_ACCENT_MIX = 0.2;
export const HALO_ACCENT_MIX = 0.15;

/**
 * CSS custom property names mirrored under `html[data-festival="mid-autumn"]`
 * in `festival.css` (builder A writes them; the HTML slips read them).
 */
export const PALETTE_CSS_VARS = {
  paperUnlit: '--festival-paper-unlit',
  paperMid: '--festival-paper-mid',
  paperCore: '--festival-paper-core',
  moonRim: '--festival-moon-rim',
  frost: '--festival-frost',
  nightNearMoon: '--festival-night-near-moon',
  tassel: '--festival-tassel',
  knot: '--festival-knot',
  ink: '--festival-ink',
  inkSecondary: '--festival-ink-secondary',
  slipPaper: '--festival-slip-paper',
  slipEdge: '--festival-slip-edge',
  /** Resolved by the hue gate at runtime. */
  poolTint: '--festival-pool-tint',
  haloTint: '--festival-halo-tint',
  /** The 谜底 underline and focus rings: always the live accent. */
  underline: '--festival-underline',
} as const;

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

const HEX = /^#?([0-9a-f]{6})$/i;

/** `#rrggbb` → 0..255 channels. Throws on anything else. */
export function hexToRgb255(hex: string): readonly [number, number, number] {
  const match = HEX.exec(hex.trim());

  if (!match) throw new RangeError(`hexToRgb255: ${hex} is not #rrggbb`);

  const value = Number.parseInt(match[1], 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** `#rrggbb` → sRGB-encoded 0..1 channels (what `THREE.Color.setRGB` wants). */
export function hexToRgb01(hex: string): Rgb01 {
  const [r, g, b] = hexToRgb255(hex);

  return [r / 255, g / 255, b / 255];
}

export function rgb01ToHex(rgb: Rgb01): Hex {
  const channel = (c: number) =>
    Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

/** Per-channel sRGB mix, like GLSL `mix(a, b, t)` on the encoded values. */
export function mixHex(a: string, b: string, t: number): Hex {
  const ca = hexToRgb01(a);
  const cb = hexToRgb01(b);

  return rgb01ToHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance Y (WCAG), 0..1. Moon > paperCore > paperMid > accent. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb01(hex).map(srgbToLinear);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];

  return (hi + 0.05) / (lo + 0.05);
}

export type Oklch = { l: number; c: number; h: number };

/** sRGB hex → OKLCH (Björn Ottosson's OKLab). `h` in degrees [0, 360). */
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb01(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;

  return { l: L, c, h: c < 1e-6 ? 0 : h };
}

/** True when the accent's OKLCH hue lies inside `ACCENT_HUE_GATE`. */
export function accentPassesHueGate(accentHex: string): boolean {
  const { h } = hexToOklch(accentHex);

  return h >= ACCENT_HUE_GATE[0] && h <= ACCENT_HUE_GATE[1];
}

export type AccentTints = {
  /** Pool colour: `mix(paperMid, accent, 0.2)` inside the gate, else paperMid. */
  pool: Hex;
  /** Halo colour: `mix(paperCore, accent, 0.15)` inside the gate, else paperCore. */
  halo: Hex;
  passed: boolean;
};

/**
 * Resolves the page-side light tints for a live `--accent` (§2.1 theme
 * behaviour). The lamp, paper, tassel, seal and moon never change; only these
 * do. The slip underline is plain CSS (`--festival-underline: var(--accent)`).
 */
export function accentTints(accentHex: string): AccentTints {
  const passed = accentPassesHueGate(accentHex);

  return {
    pool: passed
      ? mixHex(palette.paperMid, accentHex, POOL_ACCENT_MIX)
      : palette.paperMid,
    halo: passed
      ? mixHex(palette.paperCore, accentHex, HALO_ACCENT_MIX)
      : palette.paperCore,
    passed,
  };
}

/**
 * Cools a warm species colour toward `frost` by moon proximity (§2.3): the
 * mix ratio is `dLantern / (dMoon + dLantern)`, 1 beside the moon and 0 beside
 * a lantern, through `smoothstep(0.35, 0.9)`; cool = warm mixed 45% toward
 * frost. No moon (`/`) → warm. Shared by the sim (respawn colour) and fall.ts.
 */
export function coolTowardMoon(
  warm: Rgb01,
  dMoon: number | null,
  dNearestLantern: number,
): Rgb01 {
  if (dMoon === null || !Number.isFinite(dMoon)) return warm;

  const total = dMoon + dNearestLantern;
  const ratio = total > 0 ? dNearestLantern / total : 0;
  const [lo, hi] = light.floret.coolSmoothstep;
  const t = Math.max(0, Math.min(1, (ratio - lo) / (hi - lo)));
  const s = t * t * (3 - 2 * t);
  const frost = hexToRgb01(palette.frost);
  const mix = (a: Rgb01, b: Rgb01, k: number): Rgb01 => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];

  return mix(warm, mix(warm, frost, light.floret.coolMix), s);
}
