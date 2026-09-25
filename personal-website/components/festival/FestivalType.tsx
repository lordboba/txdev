'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';

import { festival } from '@/lib/festival';
import { festivalFont } from './fonts';
import styles from './festival.module.css';
import type { FestivalRuntime, Timing } from './FestivalCanvas';
import { PoemColumn } from './PoemColumn';
import { RiddleSlip } from './RiddleSlip';
import { CHOREOGRAPHY } from './scene/types';

/**
 * The HTML overlay root (bible §6.A, §7.4): PoemColumn (A1, A4, A5) and
 * RiddleSlip (A3), positioned from the custom properties the canvas writes on
 * the wrapper. Everything here is festival-only text and dies with the flag;
 * nothing lives inside a page component (T6).
 */
export function FestivalType({ runtime }: { runtime: FestivalRuntime }) {
  const view = useSyncExternalStore(
    runtime.subscribe,
    runtime.getView,
    runtime.getView,
  );
  const layout = view.layout;

  if (!layout || view.phase === 'hidden') return null;

  const lang = festival.script === 'Hant' ? 'zh-Hant' : 'zh-Hans';

  return (
    <div
      className={`${styles.root} ${festivalFont.variable}`}
      data-text={view.phase === 'exit' ? 'exit' : undefined}
      data-reduced={view.reduced ? 'true' : undefined}
      style={timingVars(view.timing)}
    >
      <PoemColumn view={view} lang={lang} timing={view.timing} />
      {view.riddle && layout.lanterns.some((l) => l.slip) ? (
        <RiddleSlip riddle={view.riddle} lang={lang} shown={view.slipShown} />
      ) : null}
    </div>
  );
}

/**
 * §4.1 or §4.2 durations for the slip and translation transitions. Block
 * starts are sim-timed (`data-shown` flips at the table's start), so the CSS
 * glyph delay counts from zero.
 */
function timingVars(timing: Timing): CSSProperties {
  const T = timing === 'mount' ? CHOREOGRAPHY.mount : CHOREOGRAPHY.route;

  return {
    '--glyph-start': '0ms',
    '--slip-ms': `${T.slipMs}ms`,
    '--translation-ms': `${T.translationMs}ms`,
  } as CSSProperties;
}
