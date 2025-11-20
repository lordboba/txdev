"use client";

import { useEffect, useState } from "react";

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
        const response = await fetch("/api/user-count", { method: "POST" });
        const data = (await response.json()) as CountResponse;

        if (cancelled) return;

        if (!response.ok || data.error) {
          setError(
            data.error ??
              "Visit counter is temporarily unavailable. Please try again soon.",
          );
          setCount(null);
          return;
        }

        setCount(data.count ?? 0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to update visitor count.",
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
    loading && count === null ? "…" : count?.toLocaleString() ?? "—";

  return (
    <div className="pane flex flex-col gap-2 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">
        Total visitors tracked
      </p>
      <p className="text-3xl font-semibold">{displayValue}</p>
      <p className="text-sm text-muted">
        {error
          ? error
          : "Live counter increments once per visit and persists in Redis."}
      </p>
    </div>
  );
}
