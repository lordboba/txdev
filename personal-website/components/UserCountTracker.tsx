'use client';

import { useEffect, useState } from 'react';

type CountResponse = {
  count: number | null;
  error?: string;
};

export function UserCountTracker() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const incrementAndFetch = async () => {
      try {
        const response = await fetch('/api/user-count', { method: 'POST' });
        const data = (await response.json()) as CountResponse;

        if (cancelled) return;

        if (!response.ok || data.error) {
          setError(
            data.error ??
              'Visit counter is temporarily unavailable. Please try again soon.',
          );
          setCount(null);
          return;
        }

        setCount(data.count ?? 0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to update visitor count.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    incrementAndFetch();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayValue =
    loading && count === null
      ? '\u2026'
      : (count?.toLocaleString() ?? '\u2014');

  return (
    <div className="pane flex flex-col gap-2 p-5">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        Total visitors tracked
      </p>
      <p className="font-display text-3xl font-semibold text-foreground">
        {displayValue}
      </p>
      <p className="text-sm text-muted">
        {error
          ? error
          : 'Live counter increments once per visit and persists in Redis.'}
      </p>
    </div>
  );
}
