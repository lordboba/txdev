/**
 * Theme state for the layer (bible §2.1 theme behaviour, §4.3): reads the
 * page's `data-theme` and live `--accent`, runs the OKLCH hue gate, and owns
 * the two damped values the scene reads each frame:
 *
 * - `night` (`uNight`, 0..1): damped toward `nightTarget` with λ 8;
 * - `tints`: the pool / halo colours, tweened linearly over 300 ms toward the
 *   gated result of the newest accent.
 *
 * `nightTarget` is 1 in the dark theme or on a route that ignores the theme
 * (`/`), else 0. Every caller (mount, route, theme event, reduced) goes
 * through `sample()`, so no path can leave a stale target behind.
 *
 * DOM-free: the reads are injected, so the node test drives it directly.
 */

import {
  accentTints,
  hexToRgb01,
  rgb01ToHex,
  siteTokens,
  type AccentTints,
} from '../palette.ts';
import { easeLinear, tween, tweenAt, type Tween } from './tween.ts';
import { CHOREOGRAPHY } from './types.ts';

const THEME = CHOREOGRAPHY.theme;

export interface ThemeIo {
  /** `html[data-theme] !== 'light'`. */
  isDark(): boolean;
  /** The computed `--accent`, `#rrggbb`. */
  readAccent(): string;
  /** Called with the gated tints whenever the accent changes (CSS mirror). */
  onTints?(tints: AccentTints): void;
}

export interface ThemeSampler {
  /** 1 on dark or a theme-ignoring route, else 0. */
  readonly nightTarget: 0 | 1;
  /** `uNight`, damped. */
  readonly night: number;
  /** Pool / halo tints, damped across an accent change. */
  readonly tints: AccentTints;
  /** True when the theme or accent differs from the last sample. */
  changed(): boolean;
  /**
   * Re-reads the theme and accent. `ts` is the sim time for the tint tween
   * (`null` before the loop runs: the tints snap). Returns whether the night
   * target flipped.
   */
  sample(ignoresTheme: boolean, ts: number | null): { nightChanged: boolean };
  /** Damps `night` (λ 8) and advances the tint tween. */
  advance(dt: number, ts: number): void;
  /** Reduced motion / mount: `night` and the tints jump to their targets. */
  snap(): void;
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

export function createThemeSampler(io: ThemeIo): ThemeSampler {
  let nightTarget: 0 | 1 = 1;
  let night = 1;
  let lastDark: boolean | null = null;
  let lastAccent = '';
  let tintsFrom: AccentTints = accentTints(siteTokens.accent.dark);
  let tintsTo: AccentTints = tintsFrom;
  let tints: AccentTints = tintsFrom;
  let tintTween: Tween | null = null;

  return {
    get nightTarget() {
      return nightTarget;
    },
    get night() {
      return night;
    },
    get tints() {
      return tints;
    },

    changed() {
      return io.isDark() !== lastDark || io.readAccent() !== lastAccent;
    },

    sample(ignoresTheme, ts) {
      const dark = io.isDark();
      const accent = io.readAccent();
      const next: 0 | 1 = ignoresTheme || dark ? 1 : 0;
      const nightChanged = next !== nightTarget;

      nightTarget = next;
      lastDark = dark;

      if (accent !== lastAccent) {
        lastAccent = accent;

        const gated = accentTints(accent);

        if (gated.pool !== tintsTo.pool || gated.halo !== tintsTo.halo) {
          tintsFrom = tints;
          tintsTo = gated;
          tintTween =
            ts === null ? null : tween(0, 1, ts, THEME.tintDampMs, easeLinear);
          if (!tintTween) tints = gated;
        }
        io.onTints?.(gated);
      }

      return { nightChanged };
    },

    advance(dt, ts) {
      night +=
        (nightTarget - night) * (1 - Math.exp(-THEME.nightDampLambda * dt));
      if (Math.abs(nightTarget - night) < 0.002) night = nightTarget;

      if (tintTween) {
        const k = tweenAt(tintTween, ts, 1);

        tints = mixTints(tintsFrom, tintsTo, k);
        if (k >= 1) tintTween = null;
      }
    },

    snap() {
      night = nightTarget;
      tints = tintsTo;
      tintTween = null;
    },
  };
}
