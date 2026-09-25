'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

import { useWebGLSupport } from '@/components/concept/shared/runtime';
import type { BlogPostMeta } from '@/lib/blog';
import {
  FESTIVAL_STORAGE_KEY,
  isFestivalRoute,
  readStoredOverride,
  resolveFestivalGate,
} from '@/lib/festival';

/**
 * The client gate for the Mid-Autumn layer (bible §7.2). `app/layout.tsx`
 * renders this only when the server flag is on; here the visitor's own clock,
 * `?festival=0|1` and `localStorage.festival` decide, and the layer (with
 * `three`) is requested only once the gate passes. `ssr: false` keeps the
 * server and the client from ever disagreeing about the date.
 */
const MidAutumnLayer = dynamic(() => import('./MidAutumnLayer'), {
  ssr: false,
});

type Gate = { active: boolean; seed: number; persist: boolean | null };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Pure: the query, the stored override and the window decide; nothing is written. */
function readGate(): Gate {
  const gate = resolveFestivalGate({
    search: window.location.search,
    storedOverride: readStoredOverride(storage()),
  });

  return {
    active: gate.active,
    seed: gate.seed ?? Math.floor(Math.random() * 1_000_000_000),
    persist: gate.persist,
  };
}

/**
 * The gate is read once per page load and never changes afterwards (the
 * query string and the stored override are fixed for the page's life), so
 * it is an external snapshot: null on the server and during hydration. The
 * one draw of the fallback seed happens inside this cache, never twice.
 */
let gateCache: Gate | null = null;
const noopSubscribe = () => () => {};
const getGate = () => (gateCache ??= readGate());
const getServerGate = () => null;

/**
 * `?festival=0|1` persists to `localStorage.festival` from a commit-phase ref
 * callback, not from the render-phase snapshot (a storage write is a side
 * effect React may repeat). The sentinel renders whenever there is an
 * override to persist, even when the gate closes the layer.
 */
function persistOverride(element: HTMLElement | null) {
  if (!element || gateCache?.persist == null) return;
  try {
    storage()?.setItem(FESTIVAL_STORAGE_KEY, gateCache.persist ? '1' : '0');
  } catch {
    // Private mode: the override lives for this page only.
  }
}

export function FestivalMount({ posts }: { posts: BlogPostMeta[] }) {
  const pathname = usePathname();
  const webGL = useWebGLSupport();
  const gate = useSyncExternalStore(noopSubscribe, getGate, getServerGate);
  const sentinel =
    gate?.persist != null ? <span ref={persistOverride} hidden /> : null;

  if (!gate?.active || !webGL || !isFestivalRoute(pathname)) return sentinel;

  return (
    <>
      {sentinel}
      <MidAutumnLayer posts={posts} seed={gate.seed} pathname={pathname} />
    </>
  );
}
