'use client';

import type { CSSProperties } from 'react';

import { COLOPHON_LABEL, colophonDate, festival } from '@/lib/festival';
import styles from './festival.module.css';
import type { FestivalView, Timing } from './FestivalCanvas';
import { CHOREOGRAPHY } from './scene/types';

/** Su Shi, 水调歌头 (1076): one line, moon pages only (bible §6.A4). */
const POEM = { Hans: '千里共婵娟', Hant: '千里共嬋娟' } as const;
const PINYIN = 'qiān lǐ gòng chán juān';
const TRANSLATION = 'a thousand miles apart, we share one moon';
/** The moon's name on hover (§6.A5). */
const MOON_NAME = { Hans: '玉盘', Hant: '玉盤' } as const;
const MOON_LABEL = 'Full moon, fifteenth night of the eighth month';
/** One `Intl.DateTimeFormat` per module, not per render. */
const COLOPHON_DATE = colophonDate();

/**
 * A1 the colophon dateline, A4 the poem column with its translation and
 * pinyin, A5 the moon's name. Positions come from the custom properties the
 * canvas writes (`--poem-*`, `--colophon-*`, `--translation-*`, `--moon-*`);
 * the reveal is one glyph per span, brush order, timed by `--i`.
 */
export function PoemColumn({
  view,
  lang,
  timing,
}: {
  view: FestivalView;
  lang: 'zh-Hans' | 'zh-Hant';
  timing: Timing;
}) {
  const layout = view.layout;

  if (!layout) return null;

  const T = timing === 'mount' ? CHOREOGRAPHY.mount : CHOREOGRAPHY.route;
  const { poem, colophon, colophonOrientation, translation, translationAlign } =
    layout.text;
  const line = POEM[festival.script];
  const glyphVars = (staggerMs: number, ms: number): CSSProperties =>
    ({
      '--glyph-stagger': `${staggerMs}ms`,
      '--glyph-ms': `${ms}ms`,
    }) as CSSProperties;

  return (
    <>
      {poem ? (
        <figure
          className={styles.figure}
          tabIndex={0}
          // The name is the verse alone; the figcaption carries the
          // translation and pinyin, so a screen reader hears each once.
          aria-label={line}
        >
          <div
            className={`${styles.column} ${styles.han}`}
            lang={lang}
            aria-hidden="true"
            data-shown={view.poemShown ? 'true' : undefined}
            style={glyphVars(T.poemGlyphStaggerMs, T.poemGlyphMs)}
          >
            {glyphs(line)}
          </div>
          {translation ? (
            <figcaption
              className={styles.caption}
              data-align={translationAlign}
              data-shown={view.translationShown ? 'true' : undefined}
            >
              <span className={`${styles.translation} ${styles.latin}`}>
                {TRANSLATION}
              </span>
              <span className={`${styles.pinyin} ${styles.mono}`}>
                {PINYIN}
              </span>
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {colophon ? (
        <p
          className={styles.colophon}
          data-orientation={colophonOrientation}
          data-home={layout.home ? 'true' : undefined}
          data-shown={view.colophonShown ? 'true' : undefined}
          style={glyphVars(T.colophonGlyphStaggerMs, T.colophonGlyphMs)}
        >
          <span className={styles.han} lang={lang}>
            {glyphs(COLOPHON_DATE)}
          </span>
          {layout.home ? (
            <span
              className={`${styles.colophonLabel} ${styles.mono} ${styles.glyph}`}
              style={{ '--i': 7 } as CSSProperties}
            >
              {COLOPHON_LABEL}
            </span>
          ) : null}
        </p>
      ) : null}

      {layout.moon ? (
        <button
          type="button"
          className={styles.moon}
          aria-label={MOON_LABEL}
          data-align={translationAlign}
        >
          <span
            className={`${styles.moonName} ${styles.latin}`}
            aria-hidden="true"
          >
            <span className={styles.han} lang={lang}>
              {MOON_NAME[festival.script]}
            </span>
            {' · jade plate'}
          </span>
        </button>
      ) : null}
    </>
  );
}

function glyphs(text: string) {
  return Array.from(text).map((glyph, i) => (
    <span
      key={`${i}-${glyph}`}
      className={styles.glyph}
      style={{ '--i': i } as CSSProperties}
    >
      {glyph}
    </span>
  ));
}
