'use client';

import Link from 'next/link';
import { Bench } from '@/components/concept/bench/Bench';
import styles from './BenchHome.module.css';

export function BenchHome({ visitorCount }: { visitorCount: number | null }) {
  return (
    <Bench
      initialView="work"
      visitorCount={visitorCount}
      actions={
        <div className={styles.dock}>
          <Link
            href="/orbital"
            className={styles.dockLink}
            aria-label="Orbital view"
          >
            <span className={styles.rocket} aria-hidden="true">
              🚀
            </span>
            <span className={styles.desktopLabel}>Orbital</span>
            <span className={styles.mobileLabel}>Orbit</span>
          </Link>
          <Link
            href="/terminal"
            className={styles.dockLink}
            aria-label="Terminal"
          >
            <span className={styles.terminalGlyph} aria-hidden="true">
              &gt;_
            </span>
            <span className={styles.desktopLabel}>Terminal</span>
            <span className={styles.mobileLabel}>Term</span>
          </Link>
        </div>
      }
    />
  );
}
