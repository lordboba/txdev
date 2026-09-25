/**
 * The festival's Han face: a hand subset of Noto Serif SC Medium (weight 500,
 * 28 glyphs, 5.6 KB woff2) built by `scripts/build-festival-font.mjs` and
 * exposed as `--font-cjk` (bible §6.A "Font"). Imported only by the festival
 * components, so the font request exists only while the flag is on.
 *
 * Han spans use `font-family: var(--font-cjk), var(--font-display), serif`
 * and carry `lang="zh-Hans"`; Latin spans keep `var(--font-display)` first so
 * Cormorant never falls into Noto. `unicode-range` limits the face to CJK
 * ideographs, CJK punctuation and U+00B7 (the 谜底 separator).
 */
import localFont from 'next/font/local';

export const FESTIVAL_FONT_VARIABLE = '--font-cjk';

export const festivalFont = localFont({
  src: './fonts/NotoSerifSC-festival.woff2',
  weight: '500',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-cjk',
  adjustFontFallback: false,
  declarations: [
    { prop: 'unicode-range', value: 'U+4E00-9FFF, U+3000-303F, U+00B7' },
  ],
});
