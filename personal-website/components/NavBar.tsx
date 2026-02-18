'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

export const navLinks = [
  { label: 'Home', href: '/', sectionId: null },
  { label: 'About', href: '/#about', sectionId: 'about' },
  { label: 'Projects', href: '/#projects', sectionId: 'projects' },
  { label: 'Blog', href: '/blog', sectionId: null },
  { label: 'Past Experience', href: '/past-experience', sectionId: null },
  { label: 'Schedule a Call', href: '/schedule-a-call', sectionId: null },
] as const;

export const NavBar = () => {
  const pathname = usePathname();
  const [homeActiveHref, setHomeActiveHref] = useState<string>('/');
  const navListRef = useRef<HTMLDivElement>(null);
  const navIndicatorRef = useRef<HTMLSpanElement>(null);

  const homeSectionLinks = useMemo(
    () => navLinks.filter((link) => Boolean(link.sectionId)),
    [],
  );

  const normalizedPath = useMemo(() => {
    if (pathname.startsWith('/blog')) return '/blog';
    return pathname;
  }, [pathname]);

  const activeHref = pathname === '/' ? homeActiveHref : normalizedPath;

  const updateIndicator = useCallback(() => {
    const navList = navListRef.current;
    const indicator = navIndicatorRef.current;
    if (!navList || !indicator) return;

    const activeLink = navList.querySelector<HTMLElement>(
      `[data-nav-href="${activeHref}"]`,
    );
    if (!activeLink) {
      indicator.style.opacity = '0';
      return;
    }

    const listRect = navList.getBoundingClientRect();
    const activeRect = activeLink.getBoundingClientRect();
    const left = activeRect.left - listRect.left;

    indicator.style.opacity = '1';
    indicator.style.width = `${activeRect.width}px`;
    indicator.style.transform = `translateX(${left}px)`;
  }, [activeHref]);

  useEffect(() => {
    if (pathname !== '/') return;

    const pickSection = () => {
      const marker = window.scrollY + window.innerHeight * 0.35;
      let selected = '/';

      homeSectionLinks.forEach((link) => {
        if (!link.sectionId) return;
        const section = document.getElementById(link.sectionId);
        if (!section) return;
        if (section.offsetTop <= marker) {
          selected = link.href;
        }
      });

      setHomeActiveHref(selected);
    };

    const frame = window.requestAnimationFrame(pickSection);
    window.addEventListener('scroll', pickSection, { passive: true });
    window.addEventListener('hashchange', pickSection);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', pickSection);
      window.removeEventListener('hashchange', pickSection);
    };
  }, [pathname, homeSectionLinks]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-surface/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-5 py-4 text-sm sm:flex-nowrap sm:justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          TYLER XIAO
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <div
            ref={navListRef}
            className="relative flex flex-wrap items-center gap-1 rounded-lg bg-surface-raised/30 p-1"
          >
            <span
              ref={navIndicatorRef}
              className="pointer-events-none absolute bottom-1 h-0.5 w-0 rounded-full bg-accent opacity-0 transition-all duration-300 ease-out"
              aria-hidden
            />
            {navLinks.map((link) => {
              const isActive = activeHref === link.href;

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  data-nav-href={link.href}
                  onClick={() => {
                    if (pathname === '/' && link.href.startsWith('/#')) {
                      setHomeActiveHref(link.href);
                    }
                  }}
                  className={`relative rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ${
                    isActive
                      ? 'text-accent'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="ml-1 border-l border-divider pl-2">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
};
