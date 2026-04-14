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
  const [mobileMenuState, setMobileMenuState] = useState({
    open: false,
    pathname,
  });
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
  const mobileOpen =
    mobileMenuState.pathname === pathname && mobileMenuState.open;

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
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-7 py-3 sm:px-5 sm:py-4">
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          TYLER XIAO
        </span>

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 text-sm md:flex">
          <div
            ref={navListRef}
            className="relative flex items-center gap-1 rounded-sm bg-surface-raised/30 p-1"
          >
            <span
              ref={navIndicatorRef}
              className="pointer-events-none absolute bottom-1 h-0.5 w-0 rounded-full bg-accent nav-indicator-glow opacity-0 transition-all duration-300 ease-out"
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
                  className={`relative rounded-sm px-3 py-1.5 font-medium transition-colors duration-200 ${
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

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button
            onClick={() =>
              setMobileMenuState((prev) => ({
                open: prev.pathname === pathname ? !prev.open : true,
                pathname,
              }))
            }
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-divider bg-surface text-foreground transition hover:border-accent/40"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              {mobileOpen ? (
                <>
                  <line x1="4" y1="4" x2="14" y2="14" />
                  <line x1="14" y1="4" x2="4" y2="14" />
                </>
              ) : (
                <>
                  <line x1="3" y1="5" x2="15" y2="5" />
                  <line x1="3" y1="9" x2="15" y2="9" />
                  <line x1="3" y1="13" x2="15" y2="13" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      <div
        className={`overflow-hidden border-t border-divider bg-surface/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 ease-out md:hidden ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-7 py-3 sm:px-5">
          {navLinks.map((link) => {
            const isActive = activeHref === link.href;

            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => {
                  setMobileMenuState({ open: false, pathname });
                  if (pathname === '/' && link.href.startsWith('/#')) {
                    setHomeActiveHref(link.href);
                  }
                }}
                className={`rounded-sm px-4 py-2.5 font-mono text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-accent-muted text-accent'
                    : 'text-muted hover:bg-surface-raised hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
};
