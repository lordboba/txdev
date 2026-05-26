'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  getOrbitalSectionHref,
  setOrbitalSectionId,
  useOrbitalSectionId,
} from '@/components/runtime/orbitalSectionStore';
import { ThemeToggle } from './ThemeToggle';

const navLinks = [
  { label: 'Home', href: '/', sectionId: null },
  { label: 'About', href: '/#about', sectionId: 'about' },
  { label: 'Projects', href: '/#projects', sectionId: 'projects' },
  { label: 'Blog', href: '/blog', sectionId: null },
  { label: 'Experience', href: '/past-experience', sectionId: null },
  { label: 'Schedule a Call', href: '/schedule-a-call', sectionId: null },
] as const;

export const NavBar = () => {
  const pathname = usePathname();
  const homeSection = useOrbitalSectionId();
  const [mobileMenuState, setMobileMenuState] = useState({
    open: false,
    pathname,
  });

  const normalizedPath = pathname.startsWith('/blog') ? '/blog' : pathname;
  const activeHref =
    pathname === '/' ? getOrbitalSectionHref(homeSection) : normalizedPath;
  const mobileOpen =
    mobileMenuState.pathname === pathname && mobileMenuState.open;

  const handleNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    sectionId: string | null,
  ) => {
    setMobileMenuState({ open: false, pathname });

    if (pathname !== '/') {
      return;
    }

    if (href === '/') {
      event.preventDefault();
      setOrbitalSectionId('home');
      return;
    }

    if (sectionId === 'about' || sectionId === 'projects') {
      event.preventDefault();
      setOrbitalSectionId(sectionId);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-surface/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          prefetch={false}
          onClick={(event) => handleNavClick(event, '/', null)}
          className="inline-flex items-center rounded-sm px-2 py-1 text-sm font-[var(--font-display)] font-semibold tracking-tight text-foreground transition-colors duration-200 hover:text-accent"
        >
          TYLER XIAO
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <div className="relative flex items-center gap-1 rounded-sm border border-divider/80 bg-surface/70 p-1">
            {navLinks.map((link) => {
              const isActive = activeHref === link.href;
              const shouldDisablePrefetch =
                link.href === '/' || link.href.startsWith('/#');

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  prefetch={shouldDisablePrefetch ? false : undefined}
                  onClick={(event) =>
                    handleNavClick(event, link.href, link.sectionId)
                  }
                  className={`relative z-10 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:text-sm ${
                    isActive
                      ? 'bg-accent text-accent-ink'
                      : 'text-muted hover:text-foreground'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
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

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() =>
              setMobileMenuState((prev) => ({
                open: prev.pathname === pathname ? !prev.open : true,
                pathname,
              }))
            }
            className="flex size-9 items-center justify-center rounded-sm border border-divider bg-surface text-muted transition-all duration-200 hover:border-accent hover:text-accent"
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

      <div
        className={`overflow-hidden border-t border-divider bg-surface/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 ease-out md:hidden ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 sm:px-6">
          {navLinks.map((link) => {
            const isActive = activeHref === link.href;
            const shouldDisablePrefetch =
              link.href === '/' || link.href.startsWith('/#');

            return (
              <Link
                key={link.label}
                href={link.href}
                prefetch={shouldDisablePrefetch ? false : undefined}
                onClick={(event) =>
                  handleNavClick(event, link.href, link.sectionId)
                }
                className={`rounded-sm px-4 py-2.5 text-[12px] font-[var(--font-mono)] font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-accent-muted text-accent'
                    : 'text-muted hover:bg-surface-raised hover:text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
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
