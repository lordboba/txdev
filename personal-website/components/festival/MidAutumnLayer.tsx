'use client';

import {
  useCallback,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';

import type { BlogPostMeta } from '@/lib/blog';
import { FESTIVAL_ATTRIBUTE_VALUE } from '@/lib/festival';
import './festival.css';
import { FestivalCanvas, type FestivalRuntime } from './FestivalCanvas';
import { FestivalType } from './FestivalType';
import { FESTIVAL_DATA_ATTRS } from './scene/types';

/**
 * The one client layer (bible §7.1, §7.4): a `display: contents` wrapper
 * appended after the page that carries the per-frame custom properties and
 * holds two fixed, pointer-transparent roots as siblings: the sky tint with
 * the WebGL canvas (z from the route table) and the HTML overlay (z
 * `overlayZIndex`: the same, except `/orbital` where the overlay must sit
 * above `.orb-shell` while the canvas stays under the rings). Loaded through
 * `FestivalMount`'s `dynamic()` so `three` is requested only once the gate
 * has passed. It sets `html[data-festival="mid-autumn"]` while mounted and
 * nothing else does. A lost WebGL context kills the layer for good (§7.6: no
 * restore, no second context).
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
  const [dead, setDead] = useState(false);
  const onRuntime = useCallback((next: FestivalRuntime | null) => {
    setRuntime(next);
  }, []);
  const view = useSyncExternalStore(
    runtime ? runtime.subscribe : noop,
    runtime ? runtime.getView : () => null,
    () => null,
  );

  // Death is sticky: once the context is lost the canvas unmounts and the
  // runtime goes away, and nothing here may mount a fresh one.
  if (view?.dead && !dead) setDead(true);
  if (dead) return null;

  const zIndex = view?.layout?.zIndex ?? 1;
  const overlayZIndex = view?.layout?.overlayZIndex ?? zIndex;

  return (
    <div
      ref={mountRoot}
      data-festival-layer=""
      data-festival-root=""
      style={{ display: 'contents' }}
    >
      <div style={fixedRoot(zIndex)} aria-hidden="true">
        <div className="festival-sky" />
        <FestivalCanvas
          seed={seed}
          posts={posts}
          pathname={pathname}
          onRuntime={onRuntime}
        />
      </div>
      {runtime ? (
        <div style={fixedRoot(overlayZIndex)}>
          <FestivalType runtime={runtime} />
        </div>
      ) : null}
    </div>
  );
}

const noop = () => () => {};

function fixedRoot(zIndex: number): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex,
    overflow: 'hidden',
  };
}

/**
 * Mount work as a ref callback with a cleanup (the React 19 form this repo
 * uses instead of effects): the attribute the festival CSS keys off lives
 * exactly as long as the wrapper. The wrapper itself lays out nothing
 * (`display: contents`) and only carries the custom properties its two fixed
 * children inherit.
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
