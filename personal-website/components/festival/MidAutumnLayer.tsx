'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

import type { BlogPostMeta } from '@/lib/blog';
import { FESTIVAL_ATTRIBUTE_VALUE } from '@/lib/festival';
import './festival.css';
import { FestivalCanvas, type FestivalRuntime } from './FestivalCanvas';
import { FestivalType } from './FestivalType';
import { FESTIVAL_DATA_ATTRS } from './scene/types';

/**
 * The one client layer (bible §7.1, §7.4): a fixed, pointer-transparent root
 * appended after the page, holding the sky tint, the WebGL canvas and the
 * HTML overlay as siblings. Loaded through `FestivalMount`'s `dynamic()` so
 * `three` is requested only once the gate has passed. It sets
 * `html[data-festival="mid-autumn"]` while mounted and nothing else does.
 */
export default function MidAutumnLayer({
  posts,
  seed,
  pathname,
}: {
  posts: BlogPostMeta[];
  seed: number;
  pathname: string;
}) {
  const [runtime, setRuntime] = useState<FestivalRuntime | null>(null);
  const onRuntime = useCallback((next: FestivalRuntime | null) => {
    setRuntime(next);
  }, []);

  return (
    <LayerRoot runtime={runtime}>
      <div className="festival-sky" aria-hidden="true" />
      <FestivalCanvas
        seed={seed}
        posts={posts}
        pathname={pathname}
        onRuntime={onRuntime}
      />
      {runtime ? <FestivalType runtime={runtime} /> : null}
    </LayerRoot>
  );
}

const noop = () => () => {};

/**
 * Mount work as a ref callback with a cleanup (the React 19 form this repo
 * uses instead of effects): the attribute the festival CSS keys off lives
 * exactly as long as the wrapper.
 */
function mountRoot(element: HTMLDivElement | null) {
  if (!element) return;

  const html = document.documentElement;

  html.setAttribute(FESTIVAL_DATA_ATTRS.festival, FESTIVAL_ATTRIBUTE_VALUE);

  return () => {
    html.removeAttribute(FESTIVAL_DATA_ATTRS.festival);
    html.removeAttribute(FESTIVAL_DATA_ATTRS.settled);
  };
}

/** The fixed wrapper; its z-index follows the route table and it dies with the context. */
function LayerRoot({
  runtime,
  children,
}: {
  runtime: FestivalRuntime | null;
  children: React.ReactNode;
}) {
  const view = useSyncExternalStore(
    runtime ? runtime.subscribe : noop,
    runtime ? runtime.getView : () => null,
    () => null,
  );
  const zIndex = view?.layout?.zIndex ?? 1;

  if (view?.dead) return null;

  return (
    <div
      ref={mountRoot}
      data-festival-layer=""
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
