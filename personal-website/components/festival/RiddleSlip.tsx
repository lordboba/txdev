'use client';

import Link from 'next/link';
import {
  useCallback,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import type { Riddle } from '@/lib/festivalRiddles';
import styles from './festival.module.css';

/**
 * A hover-opened card survives the pointer leaving the strip for this long:
 * the 谜底 link sits at the card's far corner and the natural diagonal from
 * the strip to it crosses bare page before it enters the card (≈ 80 ms for a
 * human hand on /schedule-a-call, the widest gap; 400 leaves room for a slow
 * one and is still an unnoticeable close delay).
 */
const CLOSE_GRACE_MS = 400;

type OpenedBy = 'hover' | 'focus' | 'click';

/**
 * A3, the riddle slip (灯谜) hung under lantern B (bible §6.A3). At rest a
 * vertical strip showing the 谜目, index and seal; hover, focus or tap pulls
 * it and unfolds the card under the strip with the 谜面 and, 600 ms later,
 * the 谜底 link. Escape closes (wherever focus is) and returns focus to the
 * strip; a hover-opened card closes 400 ms after the pointer leaves, a
 * focus- or click-opened one stays until blur or Escape. Pinned each frame
 * through `--slip-x/y/theta`.
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
  const cardId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pullRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef(0);
  /** Set while Escape hands focus back to the strip, so `onFocus` cannot re-open it. */
  const suppressOpen = useRef(false);
  /** How the card was opened; only a hover closes on mouseleave. */
  const openedBy = useRef<OpenedBy | null>(null);

  const cancelClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = 0;
  };

  const openAs = (by: OpenedBy) => {
    cancelClose();
    // Focus and click are stickier than hover: a click on a hover-opened
    // slip keeps it open when the pointer leaves (§6.A3).
    if (openedBy.current === null || by !== 'hover') openedBy.current = by;
    setOpen(true);
  };

  const close = () => {
    cancelClose();
    openedBy.current = null;
    setOpen(false);
  };

  /**
   * The disclosure toggles (`aria-expanded` promises it): a second Enter,
   * Space or click folds the card. A click on a hover-opened card promotes
   * it to click-opened instead and keeps it open (§6.A3).
   */
  const toggle = () => {
    if (open && openedBy.current !== 'hover') close();
    else openAs('click');
  };

  /** Escape: focus returns to the strip (the disclosure's trigger), then the card closes. */
  const escape = () => {
    const pull = pullRef.current;
    const active = document.activeElement;

    if (pull && active !== pull && wrapperRef.current?.contains(active)) {
      suppressOpen.current = true;
      pull.focus();
      suppressOpen.current = false;
    }
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) escape();
  };

  // A hover-opened card has no focus inside it: Escape is read on the document
  // while open (ref callback with cleanup, this repo's form instead of effects).
  const escapeListener = useCallback(
    (element: HTMLDivElement | null) => {
      wrapperRef.current = element;
      if (!element || !open) return;

      const onDocumentKey = (event: globalThis.KeyboardEvent) => {
        if (event.key === 'Escape') escape();
      };

      document.addEventListener('keydown', onDocumentKey);

      return () => {
        document.removeEventListener('keydown', onDocumentKey);
        cancelClose();
      };
    },
    // `escape` and `cancelClose` read refs only; `open` is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;

    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      close();
    }
  };

  const onMouseLeave = () => {
    if (openedBy.current !== 'hover') return;
    cancelClose();
    closeTimer.current = window.setTimeout(close, CLOSE_GRACE_MS);
  };

  const answer = (
    <>
      {riddle.answer}
      <ArrowIcon />
    </>
  );

  return (
    <div
      ref={escapeListener}
      className={styles.slip}
      data-shown={shown ? 'true' : undefined}
      data-open={open ? 'true' : undefined}
      // A hover-opened card also keeps a hover bridge (CSS ::after) over the
      // bare page between the strip and the card, so the diagonal to the
      // 谜底 link never leaves the wrapper; the 400 ms grace is a backstop.
      onMouseEnter={() => openAs('hover')}
      onMouseLeave={onMouseLeave}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <button
        ref={pullRef}
        type="button"
        className={styles.pull}
        aria-expanded={open}
        aria-controls={cardId}
        aria-label={riddle.ariaLabel}
        onClick={toggle}
        onFocus={() => {
          if (!suppressOpen.current) openAs('focus');
        }}
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
      <div id={cardId} className={styles.card} aria-hidden={!open}>
        <p className={`${styles.clue} ${styles.latin}`}>{riddle.clue}</p>
        <p className={`${styles.answer} ${styles.latin}`}>
          <span className={styles.answerLabel}>
            {/* The middle dot rides in the Han span: U+00B7 is in the subset (fonts.ts), not Cormorant's speck. */}
            <span className={styles.han} lang={lang}>
              {`${riddle.answerLabel} ·`}
            </span>
          </span>
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

/**
 * ↗ drawn, not typed: U+2197 is in none of the served web fonts, so the text
 * glyph fell to the system CJK face with its own weight, baseline and a
 * broken underline. The same inline-SVG arrow the bench cards use.
 */
function ArrowIcon() {
  return (
    <svg
      className={styles.arrow}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 9 9 3M4 3h5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
