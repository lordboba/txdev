'use client';

import Link from 'next/link';
import {
  useCallback,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import type { Riddle } from '@/lib/festivalRiddles';
import styles from './festival.module.css';

/**
 * A3, the riddle slip (灯谜) hung under lantern B (bible §6.A3). At rest a
 * vertical strip showing the 谜目, index and seal; hover, focus or tap pulls
 * it and unfolds the card under the strip with the 谜面 and, 600 ms later,
 * the 谜底 link. Escape closes (wherever focus is); leaving or blurring
 * closes too. Pinned each frame through `--slip-x/y/theta`.
 */
export function RiddleSlip({
  riddle,
  lang,
  shown,
}: {
  riddle: Riddle;
  lang: 'zh-Hans' | 'zh-Hant';
  shown: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Escape closes while focus is inside the slip (keyboard users open by focus).
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  // A hover-opened card has no focus inside it: Escape is read on the document
  // while open (ref callback with cleanup, this repo's form instead of effects).
  const escapeListener = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element || !open) return;

      const onDocumentKey = (event: globalThis.KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false);
      };

      document.addEventListener('keydown', onDocumentKey);

      return () => document.removeEventListener('keydown', onDocumentKey);
    },
    [open],
  );

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;

    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setOpen(false);
    }
  };

  const answer = (
    <>
      {riddle.answer}
      <span className={styles.arrow} aria-hidden="true">
        ↗
      </span>
    </>
  );

  return (
    <div
      ref={escapeListener}
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
        // Hover already opened it: a click "pulls" the slip, never snaps it shut.
        onClick={() => setOpen(true)}
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
      <div className={styles.card} aria-hidden={!open}>
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
