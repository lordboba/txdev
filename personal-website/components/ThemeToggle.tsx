'use client';

import { useCallback } from 'react';
import {
  setThemeMode,
  triggerThemeFlash,
  useIsDarkTheme,
} from '@/components/runtime/themePreferences';

export const ThemeToggle = () => {
  const isDark = useIsDarkTheme();

  const toggle = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark');
    triggerThemeFlash();
  }, [isDark]);

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-sm border border-divider bg-transparent text-muted transition-all duration-200 hover:border-accent hover:text-accent"
    >
      <span
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          isDark
            ? 'opacity-0 scale-75 rotate-[-70deg]'
            : 'opacity-100 scale-100 rotate-0'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </span>
      <span
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          isDark
            ? 'opacity-100 scale-100 rotate-0'
            : 'opacity-0 scale-75 rotate-[62deg]'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    </button>
  );
};
