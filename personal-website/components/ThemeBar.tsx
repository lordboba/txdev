'use client';

import { useCallback, useState } from 'react';
import {
  setColorTheme,
  setThemeMode,
  triggerThemeFlash,
  useColorTheme,
  useIsDarkTheme,
  type ColorTheme,
} from '@/components/runtime/themePreferences';

const THEMES = [
  { id: 'mono', label: 'Mono', color: '#ffffff' },
  { id: 'ember', label: 'Ember', color: '#e8a060' },
  { id: 'ice', label: 'Ice', color: '#5090e0' },
  { id: 'terminal', label: 'Terminal', color: '#80e840' },
] as const satisfies ReadonlyArray<{
  id: ColorTheme;
  label: string;
  color: string;
}>;

export function ThemeBar({ compact = false }: { compact?: boolean }) {
  const active = useColorTheme();
  const isDark = useIsDarkTheme();
  const [isCompactOpen, setIsCompactOpen] = useState(false);

  const select = (id: ColorTheme) => {
    setColorTheme(id);
  };

  const toggleMode = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark');
    triggerThemeFlash();
  }, [isDark]);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`group relative size-5 rounded-full border transition-all duration-200 ${
              active === t.id
                ? 'scale-105 border-accent shadow-[0_0_14px_rgba(232,196,104,0.3)]'
                : 'border-divider/80'
            }`}
            style={{
              backgroundColor: t.color,
            }}
            onClick={() => select(t.id)}
            aria-label={`${t.label} theme`}
            title={t.label}
            aria-pressed={active === t.id}
          >
            <span
              className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-sm border border-divider/80 bg-surface px-1.5 py-0.5 text-[9px] font-[var(--font-mono)] text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${
                active === t.id ? 'text-accent' : ''
              }`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
      <div className="h-4 w-px bg-divider/80" />
      <button
        className="flex size-8 items-center justify-center rounded-sm border border-divider bg-surface text-muted transition-all duration-200 hover:border-accent hover:text-accent"
        onClick={toggleMode}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? (
          <svg
            className="size-[14px] transition-transform duration-200"
            xmlns="http://www.w3.org/2000/svg"
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
        ) : (
          <svg
            className="size-[14px] transition-transform duration-200"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </>
  );

  if (compact) {
    return (
      <div className="theme-compact-bar" data-open={isCompactOpen}>
        <button
          type="button"
          className="theme-compact-toggle"
          onClick={() => setIsCompactOpen((open) => !open)}
          aria-label={
            isCompactOpen ? 'Collapse color selector' : 'Expand color selector'
          }
          aria-expanded={isCompactOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m7 14 5-5 5 5" />
          </svg>
        </button>
        <div className="theme-compact-controls">{controls}</div>
      </div>
    );
  }

  return (
    <footer className="mt-auto border-t border-divider bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-[10px] font-[var(--font-mono)] uppercase tracking-[0.18em] text-muted">
          <span>Theme controls</span>
          <span className="size-1 rounded-full bg-muted/60" />
        </div>
        <div className="flex items-center gap-2">{controls}</div>
      </div>
    </footer>
  );
}
