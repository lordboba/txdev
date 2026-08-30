'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Frame-rate independent exponential damping. `lambda` is roughly "how much
 * of the remaining distance is closed per second" — higher is snappier.
 */
export function damp(
  current: number,
  target: number,
  lambda: number,
  delta: number,
) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

/**
 * Quadratic Bezier on one axis. Used to give a camera transit a shape: with the
 * control point pushed outward from the midpoint the move arcs back and around
 * instead of sliding down the straight line three independent damps produce.
 */
export function quadraticBezier(
  from: number,
  control: number,
  to: number,
  t: number,
) {
  const inverse = 1 - t;

  return inverse * inverse * from + 2 * inverse * t * control + t * t * to;
}

/** Damp across the shortest arc so a transit never takes the long way round. */
export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  delta: number,
) {
  const twoPi = Math.PI * 2;
  let difference = (target - current) % twoPi;

  if (difference > Math.PI) {
    difference -= twoPi;
  }
  if (difference < -Math.PI) {
    difference += twoPi;
  }

  return damp(current, current + difference, lambda, delta);
}

const alwaysTrue = () => true;
const alwaysFalse = () => false;
const noopSubscribe = () => () => {};

/**
 * A subscription kept alive for the component's lifetime purely for its side
 * effect — the listener writes to a store or the DOM and never causes a
 * render. Uses the external-store boundary the rest of the app is built on.
 */
function useExternalSubscription(
  subscribe: (onStoreChange: () => void) => () => void,
) {
  useSyncExternalStore(subscribe, alwaysTrue, alwaysTrue);
}

/**
 * False on the server, true after hydration. WebGL canvases key off this, so
 * it doubles as the no-canvas fallback: the chrome simply stands alone.
 */
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
}

let reducedMotionQuery: MediaQueryList | null = null;

function getReducedMotionQuery() {
  if (!reducedMotionQuery && typeof window !== 'undefined') {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  }

  return reducedMotionQuery;
}

function subscribeToReducedMotion(onStoreChange: () => void) {
  const query = getReducedMotionQuery();

  if (!query) {
    return () => {};
  }

  query.addEventListener('change', onStoreChange);

  return () => query.removeEventListener('change', onStoreChange);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => getReducedMotionQuery()?.matches ?? false,
    alwaysFalse,
  );
}

/**
 * Normalised pointer position pushed to a store rather than state — the 3D
 * layers read it every frame and must not re-render React to do it.
 * `onMove` must be a stable reference.
 */
export function usePointerListener(onMove: (x: number, y: number) => void) {
  const subscribe = useCallback(() => {
    const handleMove = (event: PointerEvent) => {
      onMove(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    };

    window.addEventListener('pointermove', handleMove, { passive: true });

    return () => window.removeEventListener('pointermove', handleMove);
  }, [onMove]);

  useExternalSubscription(subscribe);
}

/**
 * Tracks scroll progress (0 → 1) of whichever element `attach` is placed on,
 * reporting through `onProgress`. Returns the node too, for scroll resets.
 */
export function useScrollTracker(onProgress: (progress: number) => void) {
  const node = useRef<HTMLDivElement | null>(null);

  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      node.current = element;

      if (!element) {
        return;
      }

      const handleScroll = () => {
        const range = element.scrollHeight - element.clientHeight;
        onProgress(range > 0 ? element.scrollTop / range : 0);
      };

      handleScroll();
      element.addEventListener('scroll', handleScroll, { passive: true });

      return () => element.removeEventListener('scroll', handleScroll);
    },
    [onProgress],
  );

  return { node, attach };
}
