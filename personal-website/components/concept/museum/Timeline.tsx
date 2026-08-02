'use client';

import { useCallback } from 'react';
import { gitEras } from '../conceptData';
import { readMuseumTarget, setMuseumTarget, useMuseumEra } from './museumStore';
import styles from './Museum.module.css';

export function Timeline({ reducedMotion }: { reducedMotion: boolean }) {
  const selected = useMuseumEra();

  const moveFromPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const progress = (event.clientX - bounds.left) / bounds.width;
      const target = progress * (gitEras.length - 1);
      setMuseumTarget(reducedMotion ? Math.round(target) : target);
    },
    [reducedMotion],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    moveFromPointer(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      moveFromPointer(event);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setMuseumTarget(Math.round(readMuseumTarget()));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    setMuseumTarget(selected + direction);
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineRange}>
        <span>2025-11</span>
        <span>2026-05</span>
      </div>
      <div
        aria-label="Website history"
        aria-valuemax={gitEras.length - 1}
        aria-valuemin={0}
        aria-valuenow={selected}
        aria-valuetext={`${gitEras[selected].commit} · ${gitEras[selected].label}`}
        className={styles.scrubber}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        tabIndex={0}
      >
        <span className={styles.scrubberLine} />
        <span className={styles.scrubberProgress} />
        <span className={styles.scrubberHandle} />
        <div className={styles.stops}>
          {gitEras.map((era, index) => (
            <button
              aria-label={`Show ${era.commit} · ${era.label}`}
              aria-pressed={selected === index}
              className={styles.stop}
              data-active={selected === index}
              key={era.commit}
              onClick={(event) => {
                event.stopPropagation();
                setMuseumTarget(index);
              }}
              type="button"
            >
              <i />
              <span>
                <code>{era.commit}</code> · {era.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
