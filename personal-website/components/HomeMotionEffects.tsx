'use client';

import { useEffect } from 'react';
import { usePointerGlow } from './motion/usePointerGlow';
import { useRevealOnScroll } from './motion/useRevealOnScroll';

export function HomeMotionEffects() {
  useRevealOnScroll('.reveal-on-scroll', 'is-visible');

  usePointerGlow({
    selector: '[data-pointer-profile]',
    maxTilt: 8,
    pointerXVar: '--profile-pointer-x',
    pointerYVar: '--profile-pointer-y',
  });

  usePointerGlow({
    selector: '[data-pointer-card]',
    maxTilt: 6,
  });

  useEffect(() => {
    const terminalShell = document.querySelector<HTMLElement>(
      '[data-terminal-shell]',
    );
    if (!terminalShell) return;

    const triggerPulse = () => {
      terminalShell.classList.add('terminal-awake');
      setTimeout(() => {
        terminalShell.classList.remove('terminal-awake');
      }, 1400);
    };

    const onceOptions: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener('scroll', triggerPulse, onceOptions);
    window.addEventListener('click', triggerPulse, { once: true });
    window.addEventListener('keydown', triggerPulse, { once: true });

    return () => {
      window.removeEventListener('scroll', triggerPulse);
      window.removeEventListener('click', triggerPulse);
      window.removeEventListener('keydown', triggerPulse);
    };
  }, []);

  useEffect(() => {
    const timeline = document.querySelector<HTMLElement>(
      '[data-timeline-root]',
    );
    if (!timeline) return;

    const items = Array.from(
      timeline.querySelectorAll<HTMLElement>('[data-timeline-item]'),
    );
    if (!items.length) return;

    const activateItem = (item: HTMLElement) => {
      timeline.classList.add('timeline-focus');
      items.forEach((entry) => entry.classList.remove('is-hovered'));
      item.classList.add('is-hovered');
    };

    const reset = () => {
      timeline.classList.remove('timeline-focus');
      items.forEach((entry) => entry.classList.remove('is-hovered'));
    };

    const cleanups: Array<() => void> = [];

    items.forEach((item) => {
      const onMouseEnter = () => activateItem(item);
      const onFocus = () => activateItem(item);
      const onBlur = () => {
        const activeWithinTimeline = timeline.contains(
          document.activeElement as Node,
        );
        if (!activeWithinTimeline && !timeline.matches(':hover')) {
          reset();
        }
      };

      item.addEventListener('mouseenter', onMouseEnter);
      item.addEventListener('focusin', onFocus);
      item.addEventListener('focusout', onBlur);

      cleanups.push(() => {
        item.removeEventListener('mouseenter', onMouseEnter);
        item.removeEventListener('focusin', onFocus);
        item.removeEventListener('focusout', onBlur);
      });
    });

    const onMouseLeave = () => reset();
    timeline.addEventListener('mouseleave', onMouseLeave);

    cleanups.push(() =>
      timeline.removeEventListener('mouseleave', onMouseLeave),
    );

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
