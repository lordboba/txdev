'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

export const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/#about' },
  { label: 'Past Experience', href: '/past-experience' },
  { label: 'Schedule a Call', href: '/schedule-a-call' },
];

export const NavBar = () => {
  const currentPath = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-surface/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-5 py-4 text-sm sm:justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          TYLER XIAO
        </span>
        <div className="flex flex-wrap items-center gap-1 text-xs sm:text-sm">
          {navLinks.map((link) => {
            const isActive =
              link.href === currentPath ||
              (link.href === '/' && currentPath === '/');

            if (link.href.startsWith('#')) {
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-lg px-3 py-1.5 font-medium text-muted transition hover:text-foreground"
                >
                  {link.label}
                </a>
              );
            }

            if (link.href === currentPath) return null;

            return (
              <Link
                key={link.label}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  isActive ? 'text-accent' : 'text-muted hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="ml-2 border-l border-divider pl-2">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
};
