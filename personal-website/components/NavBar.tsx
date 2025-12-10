'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/#about' },
  { label: 'Past Experience', href: '/past-experience' },
  { label: 'Schedule a Call', href: '/schedule-a-call' },
];

export const NavBar = () => {
  const currentPath = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-background/95 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-5 py-4 text-sm sm:justify-between">
        <span className="font-semibold tracking-[0.25em]">TYLER XIAO</span>
        <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
          {navLinks.map((link) =>
            link.href.startsWith('#') ? (
              <a
                key={link.label}
                href={link.href}
                className="rounded-full border border-transparent px-3 py-1 text-muted transition hover:border-divider hover:text-foreground hover:underline"
              >
                {link.label}
              </a>
            ) : link.href === currentPath ? null : (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-full border border-transparent px-3 py-1 text-muted transition hover:border-divider hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      </nav>
    </header>
  );
};
