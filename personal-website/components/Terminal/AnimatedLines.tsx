'use client';

import type { CSSProperties } from 'react';
import { useSyncExternalStore } from 'react';

type AnimatedLine = {
  text: string;
  className?: string;
};

type AnimatedLinesProps = {
  lines: AnimatedLine[];
};

export function AnimatedLines({ lines }: AnimatedLinesProps) {
  const prefersReducedMotion = useSyncExternalStore(
    (callback) => {
      if (typeof window === 'undefined') return () => {};
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      query.addEventListener('change', callback);
      return () => query.removeEventListener('change', callback);
    },
    () => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    () => false,
  );

  return (
    <div className="space-y-1">
      {lines.map((line, index) => (
        <div
          key={`${line.text}-${index}`}
          className={`${line.className ?? ''} ${
            prefersReducedMotion ? '' : 'terminal-typed-line'
          }`}
          style={
            prefersReducedMotion
              ? undefined
              : ({ animationDelay: `${index * 120}ms` } as CSSProperties)
          }
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}
