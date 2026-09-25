'use client';

import Link from 'next/link';
import { useState, type FocusEvent, type KeyboardEvent } from 'react';

import type { Riddle } from '@/lib/festivalRiddles';
import styles from './festival.module.css';

/**
 * A3, the riddle slip (灯谜) hung under lantern B (bible §6.A3). At rest a
 * vertical strip showing the 谜目, index and seal; hover, focus or tap pulls
 * it and unfolds the card with the 谜面 and, 600 ms later, the 谜底 link.
 * Escape closes. Pinned each frame through `--slip-x/y/theta`.
 */
export function RiddleSlip({
  riddle,
  lang,
  shown,
  side,
}: {
  riddle: Riddle;
  lang: 'zh-Hans' | 'zh-Hant';
  shown: boolean;
  side: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);

  // Escape closes while focus is inside the slip (keyboard users open by focus).
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;

    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setOpen(false);
    }
  };

  const answer = `${riddle.answer} ↗`;

  return (
    <div
      className={styles.slip}
      data-shown={shown ? 'true' : undefined}
      data-open={open ? 'true' : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={styles.pull}
        aria-expanded={open}
        aria-label={riddle.ariaLabel}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
      >
        <span className={styles.strip}>
          <span className={`${styles.slipIndex} ${styles.mono}`}>
            {riddle.label}
          </span>
          <span className={`${styles.slipTarget} ${styles.han}`} lang={lang}>
            {riddle.target}
          </span>
          <span className={styles.slipSeal} aria-hidden="true" />
        </span>
      </button>
      <div className={styles.card} data-side={side} aria-hidden={!open}>
        <p className={`${styles.clue} ${styles.latin}`}>{riddle.clue}</p>
        <p className={`${styles.answer} ${styles.latin}`}>
          <span className={`${styles.answerLabel} ${styles.han}`} lang={lang}>
            {riddle.answerLabel}
          </span>
          {' · '}
          {riddle.external ? (
            <a
              className={styles.answerLink}
              href={riddle.href}
              target="_blank"
              rel="noreferrer"
              tabIndex={open ? 0 : -1}
            >
              {answer}
            </a>
          ) : (
            <Link
              className={styles.answerLink}
              href={riddle.href}
              tabIndex={open ? 0 : -1}
            >
              {answer}
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
