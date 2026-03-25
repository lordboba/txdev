'use client';

import { useEffect } from 'react';

type PointerGlowOptions = {
  selector: string;
  maxTilt?: number;
  pointerXVar?: string;
  pointerYVar?: string;
  tiltXVar?: string;
  tiltYVar?: string;
};

export function usePointerGlow({
  selector,
  maxTilt = 7,
  pointerXVar = '--pointer-x',
  pointerYVar = '--pointer-y',
  tiltXVar = '--tilt-x',
  tiltYVar = '--tilt-y',
}: PointerGlowOptions) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    );
    if (!elements.length) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const coarsePointer = window.matchMedia(
      '(hover: none), (pointer: coarse)',
    ).matches;

    if (prefersReducedMotion || coarsePointer) return;

    const cleanupFns: Array<() => void> = [];

    elements.forEach((element) => {
      let frameId = 0;
      let pendingEvent: PointerEvent | null = null;

      const updateFromPointer = () => {
        frameId = 0;
        if (!pendingEvent) return;

        const rect = element.getBoundingClientRect();
        const x = pendingEvent.clientX - rect.left;
        const y = pendingEvent.clientY - rect.top;

        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;

        const tiltY = (x / rect.width - 0.5) * maxTilt;
        const tiltX = (0.5 - y / rect.height) * maxTilt;

        element.style.setProperty(pointerXVar, `${px}%`);
        element.style.setProperty(pointerYVar, `${py}%`);
        element.style.setProperty(tiltXVar, `${tiltX.toFixed(2)}deg`);
        element.style.setProperty(tiltYVar, `${tiltY.toFixed(2)}deg`);
      };

      const onMove = (event: PointerEvent) => {
        pendingEvent = event;
        if (frameId) return;
        frameId = window.requestAnimationFrame(updateFromPointer);
      };

      const onLeave = () => {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        pendingEvent = null;
        element.style.setProperty(pointerXVar, '50%');
        element.style.setProperty(pointerYVar, '50%');
        element.style.setProperty(tiltXVar, '0deg');
        element.style.setProperty(tiltYVar, '0deg');
      };

      element.addEventListener('pointermove', onMove);
      element.addEventListener('pointerleave', onLeave);

      cleanupFns.push(() => {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }
        element.removeEventListener('pointermove', onMove);
        element.removeEventListener('pointerleave', onLeave);
      });
    });

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [selector, maxTilt, pointerXVar, pointerYVar, tiltXVar, tiltYVar]);
}
