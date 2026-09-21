'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { conceptViews, gitEras, type ConceptViewId } from '../conceptData';
import { setConceptView, useConceptView } from '../conceptViewStore';
import { usePrefersReducedMotion } from '../shared/runtime';
import { eraPalettes } from './museumData';
import { attachMuseumRoot, useMuseumEra } from './museumStore';
import { Timeline } from './Timeline';
import { HistoryView, ProfileView, SignalsView, WorkView } from './views';
import styles from './Museum.module.css';

function useMuseumView() {
  const sharedView = useConceptView();

  if (typeof window === 'undefined' || window.location.hash.length === 0) {
    return 'history';
  }

  return sharedView;
}

export function Museum() {
  const view = useMuseumView();
  const selectedEra = useMuseumEra();
  const reducedMotion = usePrefersReducedMotion();
  const activeEra = gitEras[selectedEra];

  if (
    eraPalettes.length !== gitEras.length ||
    eraPalettes.some(
      (palette, index) => palette.commit !== gitEras[index].commit,
    )
  ) {
    throw new Error('Museum palettes must correspond exactly to gitEras.');
  }

  const attach = useCallback(
    (node: HTMLElement | null) =>
      attachMuseumRoot(node, reducedMotion) as (() => void) | undefined,
    [reducedMotion],
  );

  const selectView = (nextView: ConceptViewId) => {
    setConceptView(nextView);
  };

  const handleNavKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const current = conceptViews.findIndex((entry) => entry.id === view);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next =
      (current + direction + conceptViews.length) % conceptViews.length;
    selectView(conceptViews[next].id);
  };

  return (
    <main
      className={styles.museum}
      data-reduced-motion={reducedMotion}
      data-view={view}
      ref={attach}
    >
      <header className={styles.header}>
        <Link className={styles.museumMark} href="/">
          Tyler Xiao / Museum
        </Link>
        <nav
          aria-label="Museum wings"
          className={styles.nav}
          onKeyDown={handleNavKeyDown}
        >
          {conceptViews.map((entry) => (
            <button
              aria-pressed={entry.id === view}
              data-active={entry.id === view}
              key={entry.id}
              onClick={() => selectView(entry.id)}
              type="button"
            >
              {entry.shortLabel}
            </button>
          ))}
        </nav>
        <div className={styles.activeReference}>
          <code>{activeEra.commit}</code>
          <span>{activeEra.label}</span>
        </div>
      </header>

      <div className={styles.room}>
        <div
          aria-hidden={view !== 'history'}
          className={styles.viewPanel}
          data-active={view === 'history'}
        >
          <HistoryView selected={selectedEra} />
        </div>
        <div
          aria-hidden={view !== 'profile'}
          className={styles.viewPanel}
          data-active={view === 'profile'}
        >
          <ProfileView />
        </div>
        <div
          aria-hidden={view !== 'work'}
          className={styles.viewPanel}
          data-active={view === 'work'}
        >
          <WorkView />
        </div>
        <div
          aria-hidden={view !== 'signals'}
          className={styles.viewPanel}
          data-active={view === 'signals'}
        >
          <SignalsView />
        </div>
      </div>

      <footer className={styles.footer}>
        <p>
          Six homepage eras, reconstructed from this repository&apos;s history.
        </p>
        <Timeline reducedMotion={reducedMotion} />
      </footer>
    </main>
  );
}
