'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { conceptViews, gitEras, type ConceptViewId } from '../conceptData';
import { setConceptView, useConceptView } from '../conceptViewStore';
import {
  useMounted,
  usePrefersReducedMotion,
  useScrollTracker,
} from '../shared/runtime';
import { Armature } from './Armature';
import {
  readAzimuth,
  readElevation,
  setArmatureFocus,
  setScrollProgress,
} from './armatureStore';
import { LiveValue, Readout } from './Readout';
import { HistoryView, ProfileView, SignalsView, WorkView } from './views';
import styles from './Observatory.module.css';

const GIT_REF = 'main@ad3e3a7';

function degrees(radians: number) {
  const value = ((radians * 180) / Math.PI) % 360;

  return (value < 0 ? value + 360 : value).toFixed(1).padStart(5, '0');
}

const readAzimuthLabel = () => degrees(readAzimuth());
const readElevationLabel = () => degrees(readElevation());

export function Observatory() {
  const view = useConceptView();
  const reducedMotion = usePrefersReducedMotion();
  const mounted = useMounted();
  const body = useScrollTracker(setScrollProgress);
  const activeIndex = conceptViews.findIndex((entry) => entry.id === view);

  const select = useCallback((next: ConceptViewId) => {
    setConceptView(next);
    setArmatureFocus(next, next === 'history' ? gitEras.length - 1 : -1);
    body.node.current?.scrollTo({ top: 0 });
    // `body` is a stable object of refs from useScrollTracker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next =
      (activeIndex + step + conceptViews.length) % conceptViews.length;
    select(conceptViews[next].id);
  };

  return (
    <main className={styles.shell} data-view={view}>
      {mounted ? (
        <Armature className={styles.canvas} reducedMotion={reducedMotion} />
      ) : null}

      <header className={styles.railTop}>
        <Link className={styles.mark} href="/">
          TX/OBS
        </Link>

        <nav
          aria-label="Observation angle"
          className={styles.nav}
          onKeyDown={handleNavKey}
        >
          {conceptViews.map((entry) => (
            <button
              aria-pressed={entry.id === view}
              className={styles.navItem}
              data-active={entry.id === view}
              key={entry.id}
              onClick={() => select(entry.id)}
              type="button"
            >
              <span>0{entry.index.slice(-1)}</span>
              {entry.shortLabel}
            </button>
          ))}
        </nav>

        <div className={styles.telemetry}>
          <span className={styles.tag}>AZ</span>
          <LiveValue read={readAzimuthLabel} />
          <span className={styles.tag}>EL</span>
          <LiveValue read={readElevationLabel} />
        </div>
      </header>

      <div aria-hidden="true" className={styles.gutter}>
        <span className={styles.gutterLabel}>
          <Readout value={`REV ${conceptViews[activeIndex].index}`} />
        </span>
        <span className={styles.ruler} />
      </div>

      <div className={styles.body} ref={body.attach}>
        <div className={styles.content} key={view}>
          {view === 'profile' ? <ProfileView /> : null}
          {view === 'work' ? (
            <WorkView onFocus={(index) => setArmatureFocus('work', index)} />
          ) : null}
          {view === 'signals' ? <SignalsView /> : null}
          {view === 'history' ? (
            <HistoryView
              onFocus={(index) => setArmatureFocus('history', index)}
            />
          ) : null}
        </div>
      </div>

      <footer className={styles.railBottom}>
        <span>
          <span className={styles.tag}>MODE</span>
          <Readout value={conceptViews[activeIndex].label.toUpperCase()} />
        </span>
        <span className={styles.railNote}>
          {conceptViews[activeIndex].description}
        </span>
        <span>
          <span className={styles.tag}>SRC</span>
          {GIT_REF}
        </span>
      </footer>
    </main>
  );
}
