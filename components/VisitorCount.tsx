'use client';

import { useEffect, useState } from 'react';

type CountResponse = {
  count: number | null;
  error?: string;
};

export function VisitorCount() {
  const [count, setCount] = useState<number | null>(null);
  const [animatedCount, setAnimatedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const response = await fetch('/api/user-count', { method: 'POST' });
        const data = (await response.json()) as CountResponse;
        if (!cancelled && !data.error && data.count !== null) {
          setCount(data.count);
        }
      } catch {
        // silently fail — counter is non-critical
      }
    };

    fetchCount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (count === null) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduceMotion) {
      setAnimatedCount(count);
      return;
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
  }, [count]);

  if (count === null) return null;

  return (
    <div className="visitor-count">
      <span className="visitor-count-dot" />
      <span className="visitor-count-number">
        {animatedCount.toLocaleString()}
      </span>
      <span className="visitor-count-label">visits</span>
    </div>
  );
}
