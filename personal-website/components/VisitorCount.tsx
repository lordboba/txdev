'use client';

import { useEffect, useState } from 'react';

export function VisitorCount({
  count,
  reducedMotion,
}: {
  count: number | null;
  reducedMotion: boolean;
}) {
  const [animatedCount, setAnimatedCount] = useState(0);

  useEffect(() => {
    if (count === null) return;

    if (reducedMotion) {
      const frame = window.requestAnimationFrame(() => {
        setAnimatedCount(count);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    let frame = 0;
    const duration = 1000;
    const start = performance.now();

    const animate = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedCount(Math.round(count * eased));
      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [count, reducedMotion]);

  if (count === null) return null;

  return (
    <div
      className="visitor-count"
      role="status"
      aria-live="polite"
      title="Estimated total portfolio visits"
    >
      <span className="visitor-count-dot" />
      <span className="visitor-count-text">
        {animatedCount.toLocaleString()} <em>observers</em>
      </span>
    </div>
  );
}
