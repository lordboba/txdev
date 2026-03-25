'use client';

import { useEffect } from 'react';

export function useRevealOnScroll(
  selector = '.reveal-on-scroll',
  visibleClass = 'is-visible',
) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    );

    if (!elements.length) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      elements.forEach((element) => element.classList.add(visibleClass));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(visibleClass);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -12% 0px',
      },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [selector, visibleClass]);
}
