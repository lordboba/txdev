'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/#profile' },
  { label: 'Projects', href: '/#work' },
  { label: 'Blog', href: '/blog' },
  { label: 'Experience', href: '/past-experience' },
  { label: 'Schedule a Call', href: '/schedule-a-call' },
] as const;

export const NavBar = () => {
  const pathname = usePathname();
  const [mobileMenuState, setMobileMenuState] = useState({
    open: false,
    pathname,
  });

  const normalizedPath = pathname.startsWith('/blog') ? '/blog' : pathname;
  const activeHref = normalizedPath;
  const mobileOpen =
    mobileMenuState.pathname === pathname && mobileMenuState.open;

  const handleNavClick = () => {
    setMobileMenuState({ open: false, pathname });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-surface/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          prefetch={false}
          onClick={handleNavClick}
          className="inline-flex items-center rounded-sm px-2 py-1 font-display text-[1.1rem] leading-none font-medium tracking-[-0.01em] text-foreground transition-colors duration-200 hover:text-accent"
        >
          Tyler Xiao
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <div className="relative flex items-center gap-7">
            {navLinks.map((link) => {
              const isActive = activeHref === link.href;
              const shouldDisablePrefetch =
                link.href === '/' || link.href.startsWith('/#');

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  prefetch={shouldDisablePrefetch ? false : undefined}
                  onClick={handleNavClick}
                  className={`relative inline-flex min-h-11 items-center text-[0.82rem] leading-none font-medium tracking-[0.015em] transition-colors duration-200 after:absolute after:inset-x-0 after:bottom-[5px] after:h-px after:bg-current after:transition-transform after:duration-[360ms] after:ease-[cubic-bezier(0.2,0.8,0.2,1)] after:content-[''] hover:after:scale-x-100 ${
                    isActive
                      ? 'text-foreground font-semibold after:scale-x-100'
                      : 'text-muted after:scale-x-0 hover:text-foreground'
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
                onClick={handleNavClick}
                className={`label-sm rounded-sm px-4 py-2.5 font-medium transition-colors duration-200 ${
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
