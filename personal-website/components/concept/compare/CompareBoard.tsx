'use client';

import Link from 'next/link';
import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { conceptViews, type ConceptViewId } from '../conceptData';
import { conceptEntries } from '../conceptRegistry';
import { CONCEPT_VIEW_MESSAGE } from '../conceptViewStore';
import styles from './CompareBoard.module.css';

const FRAME_SIZE = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

const COLUMN_GAP = 16;
const CHROME_HEIGHT = 128;

/**
 * Baked into each frame's src so the first paint already matches. Every later
 * change goes over postMessage instead, so frames are never reloaded and
 * their transit animations stay watchable side by side.
 */
const INITIAL_VIEW: ConceptViewId = 'profile';

type Viewport = keyof typeof FRAME_SIZE;

export function CompareBoard() {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [view, setView] = useState<ConceptViewId>(INITIAL_VIEW);
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);
  const size = FRAME_SIZE[viewport];

  const post = useCallback(
    (frame: HTMLIFrameElement | null, next: ConceptViewId) => {
      frame?.contentWindow?.postMessage(
        { type: CONCEPT_VIEW_MESSAGE, view: next },
        window.location.origin,
      );
    },
    [],
  );

  const selectView = (next: ConceptViewId) => {
    setView(next);
    frames.current.forEach((frame) => post(frame, next));
  };

  /**
   * Scale is written straight to a custom property rather than held in state:
   * the frames render at true device width and are shrunk to fit, so what you
   * compare is the real layout, not a responsive fallback.
   */
  const measureStage = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }

      const apply = () => {
        const columnWidth =
          (node.clientWidth - COLUMN_GAP * (conceptEntries.length - 1)) /
          conceptEntries.length;
        const columnHeight = node.clientHeight - CHROME_HEIGHT;
        const scale = Math.min(
          columnWidth / size.width,
          Math.max(columnHeight, 240) / size.height,
          1,
        );

        node.style.setProperty('--frame-scale', String(scale));
      };

      apply();
      const observer = new ResizeObserver(apply);
      observer.observe(node);

      return () => observer.disconnect();
    },
    [size.width, size.height],
  );

  const frameStyle = {
    '--frame-width': `${size.width}px`,
    '--frame-height': `${size.height}px`,
  } as CSSProperties;

  return (
    <main className={styles.shell}>
      <header className={styles.bar}>
        <Link className={styles.mark} href="/">
          ← Tyler Xiao
        </Link>

        <div className={styles.controls}>
          <div aria-label="View" className={styles.group} role="group">
            {conceptViews.map((entry) => (
              <button
                data-active={entry.id === view}
                key={entry.id}
                onClick={() => selectView(entry.id)}
                type="button"
              >
                {entry.shortLabel}
              </button>
            ))}
          </div>

          <div aria-label="Viewport" className={styles.group} role="group">
            {(Object.keys(FRAME_SIZE) as Viewport[]).map((option) => (
              <button
                data-active={option === viewport}
                key={option}
                onClick={() => setViewport(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <p className={styles.note}>Four directions · same content</p>
      </header>

      <div className={styles.stage} ref={measureStage} style={frameStyle}>
        {conceptEntries.map((entry, index) => (
          <section className={styles.column} key={entry.id}>
            <header className={styles.columnHead}>
              <span className={styles.code}>{entry.code}</span>
              <Link href={`${entry.route}#${view}`}>{entry.name}</Link>
              <span aria-hidden="true" className={styles.swatches}>
                {entry.palette.map((colour) => (
                  <i key={colour} style={{ background: colour }} />
                ))}
              </span>
            </header>

            <div className={styles.viewport}>
              <iframe
                onLoad={(event) => post(event.currentTarget, view)}
                ref={(node) => {
                  frames.current[index] = node;
                }}
                src={`${entry.route}#${INITIAL_VIEW}`}
                title={`${entry.name} concept preview`}
              />
            </div>

            <dl className={styles.spec}>
              <dt>Thesis</dt>
              <dd>{entry.thesis}</dd>
              <dt>Object</dt>
              <dd>{entry.object}</dd>
              <dt>Motion</dt>
              <dd>{entry.motion}</dd>
            </dl>
          </section>
        ))}
      </div>
    </main>
  );
}
