'use client';

import { useCallback } from 'react';
import { usePrefersReducedMotion } from '../shared/runtime';

const SCRAMBLE_CHARS = '0123456789·/';
const SCRAMBLE_MS = 380;

/**
 * A value that resolves left-to-right instead of simply changing. This is the
 * single detail that makes the chrome read as an instrument rather than a
 * label, so it runs on every value the transit touches.
 *
 * The span is keyed by value, so a new value remounts it and the ref callback
 * below acts as the animation's mount hook and cleanup.
 */
export function Readout({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  const attach = useCallback(
    (element: HTMLSpanElement | null) => {
      if (!element) {
        return;
      }

      if (reducedMotion) {
        element.textContent = value;
        return;
      }

      const start = performance.now();
      let frame = 0;

      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / SCRAMBLE_MS);
        const settled = Math.floor(value.length * progress);
        let output = value.slice(0, settled);

        for (let i = settled; i < value.length; i += 1) {
          output +=
            value[i] === ' '
              ? ' '
              : SCRAMBLE_CHARS[
                  Math.floor(Math.random() * SCRAMBLE_CHARS.length)
                ];
        }

        element.textContent = output;

        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        }
      };

      frame = requestAnimationFrame(tick);

      return () => cancelAnimationFrame(frame);
    },
    [value, reducedMotion],
  );

  return (
    <span className={className} key={value} ref={attach}>
      {value}
    </span>
  );
}

/**
 * Telemetry sampled every frame straight from the 3D layer. Kept out of React
 * state on purpose — these are 60fps values, not renders.
 */
export function LiveValue({
  read,
  className,
}: {
  read: () => string;
  className?: string;
}) {
  const attach = useCallback(
    (element: HTMLSpanElement | null) => {
      if (!element) {
        return;
      }

      let frame = 0;

      const tick = () => {
        const next = read();

        if (element.textContent !== next) {
          element.textContent = next;
        }

        frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);

      return () => cancelAnimationFrame(frame);
    },
    // `read` closes over a ref, so it stays correct across renders even
    // though this only captures the first one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return <span className={className} ref={attach} />;
}
