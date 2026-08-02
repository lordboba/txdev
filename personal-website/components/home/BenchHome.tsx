'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type AnimationEvent, type MouseEvent } from 'react';
import { Bench } from '@/components/concept/bench/Bench';
import { usePrefersReducedMotion } from '@/components/concept/shared/runtime';
import styles from './BenchHome.module.css';

export function BenchHome({ visitorCount }: { visitorCount: number | null }) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [launching, setLaunching] = useState(false);

  /**
   * Plain left-clicks (and keyboard activation, which arrives as a click)
   * launch the site instead of navigating instantly. Modified clicks,
   * middle-clicks, and reduced-motion users keep native Link behaviour —
   * href="/orbital" stays intact so prefetch still works.
   */
  const handleRocketClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion) {
      return;
    }
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    if (!launching) {
      setLaunching(true);
    }
  };

  /**
   * Navigation is keyed to the shell's own animation finishing — not a
   * setTimeout — so the launched frame holds until the route change lands.
   * The rocket glyph's ride-ahead animation bubbles here too; the target
   * check ignores it.
   */
  const handleLaunchEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    router.push('/orbital');
  };

  return (
    <div
      className={
        launching ? `${styles.launchpad} ${styles.contained}` : styles.launchpad
      }
    >
      <div
        className={
          launching ? `${styles.shell} ${styles.launching}` : styles.shell
        }
        onAnimationEnd={handleLaunchEnd}
      >
        <Bench
          initialView="work"
          visitorCount={visitorCount}
          actions={
            <div className={styles.dock}>
              <Link
                href="/orbital"
                className={styles.dockLink}
                aria-label="Orbital view"
                onClick={handleRocketClick}
              >
                <span
                  className={
                    launching
                      ? `${styles.rocket} ${styles.rocketLaunching}`
                      : styles.rocket
                  }
                  aria-hidden="true"
                >
                  🚀
                </span>
              </Link>
              <Link
                href="/terminal"
                className={styles.dockLink}
                aria-label="Terminal"
              >
                <span className={styles.terminalGlyph} aria-hidden="true">
                  <span className={styles.binaryRain}>
                    <span>0</span>
                    <span>1</span>
                    <span>1</span>
                    <span>0</span>
                    <span>1</span>
                    <span>0</span>
                  </span>
                  <span className={styles.terminalEmoji}>🖥️</span>
                </span>
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
