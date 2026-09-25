'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, type AnimationEvent, type MouseEvent } from 'react';
import { Bench } from '@/components/concept/bench/Bench';
import { usePrefersReducedMotion } from '@/components/concept/shared/runtime';
import styles from './BenchHome.module.css';

export function BenchHome({ visitorCount }: { visitorCount: number | null }) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [launching, setLaunching] = useState(false);
  /* SVG ids are document-global; a literal one would collide the moment two
   * BenchHomes share a page (a preview strip, a comparison board) and leave
   * both moons pointing at the first mask. */
  const moonPhaseMaskId = useId();

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
      window.dispatchEvent(new CustomEvent('bench:launch'));
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
              {/*
               * The Easter egg. Same destination as the rocket, none of its
               * ceremony: a plain route change is what a secret door should
               * do, so this Link deliberately skips handleRocketClick and the
               * bench:launch dispatch. prefetch={false} keeps a door nobody
               * has found yet off the network.
               *
               * It is the one dock item that does NOT carry its name: pointer
               * only, out of the tab order and out of the accessibility tree.
               * Named, it put a second "Orbital view" link immediately before
               * the rocket's — two adjacent links to one destination, the
               * secret announced first and its own label spelling it out. The
               * reward here is a hover phase change no keyboard or screen
               * reader can collect anyway, and the rocket beside it carries
               * /orbital for everyone.
               */}
              <Link
                href="/orbital"
                prefetch={false}
                className={`${styles.dockLink} ${styles.moonLink}`}
                aria-hidden="true"
                tabIndex={-1}
              >
                <span className={styles.moonLabel} aria-hidden="true">
                  Orbital
                </span>
                {/*
                 * Drawn, not an emoji — 🌙 would arrive in a colour and a
                 * rendering family the dock does not own. An inline disc
                 * inked with currentColor lives in the same grey system as
                 * ">_", and the phase is the whole interaction: the occluder
                 * inside the mask slides off on hover, so a barely-there
                 * crescent waxes full. Geometry in a 24-unit box; the
                 * occluder's r exceeds the disc's so the terminator stays a
                 * clean arc at every offset.
                 */}
                <svg
                  className={styles.moonGlyph}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <mask id={moonPhaseMaskId}>
                    <rect x="0" y="0" width="24" height="24" fill="#fff" />
                    <circle
                      className={styles.moonShadow}
                      cx="12"
                      cy="12"
                      r="8.6"
                      fill="#000"
                    />
                  </mask>
                  <circle
                    className={styles.moonDisc}
                    cx="12"
                    cy="12"
                    r="8"
                    mask={`url(#${moonPhaseMaskId})`}
                  />
                </svg>
              </Link>
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
                  {/*
                   * A typographic prompt, not an emoji: 🖥 rendered as a
                   * flat grey desktop monitor — the wrong object (the Macs
                   * on the bench are the monitors here) in a different
                   * rendering family from its neighbour. `>_` is the
                   * terminal's own convention, set in the site mono and
                   * inked with currentColor, so it lives in the same
                   * grey/ink system as the rest of the studio.
                   */}
                  <span className={styles.terminalMark}>{'>_'}</span>
                </span>
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
