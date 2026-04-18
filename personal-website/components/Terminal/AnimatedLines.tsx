'use client';

import type { CSSProperties } from 'react';
import { useReducedMotion } from '@/components/runtime/themePreferences';

type AnimatedLine = {
  text: string;
  className?: string;
};

type AnimatedLinesProps = {
  lines: AnimatedLine[];
};

export function AnimatedLines({ lines }: AnimatedLinesProps) {
  const prefersReducedMotion = useReducedMotion();

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
