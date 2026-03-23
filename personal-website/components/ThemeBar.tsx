'use client';

import { useState, useEffect, useCallback } from 'react';

const THEMES = [
  { id: 'mono', label: 'Mono', color: '#ffffff' },
  { id: 'ember', label: 'Ember', color: '#e8a060' },
  { id: 'ice', label: 'Ice', color: '#5090e0' },
  { id: 'terminal', label: 'Terminal', color: '#80e840' },
] as const;

export function ThemeBar() {
  const [active, setActive] = useState('mono');
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('color-theme');
    if (saved && THEMES.some((t) => t.id === saved)) {
      setActive(saved);
      document.documentElement.setAttribute('data-color-theme', saved);
    }
    setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
  }, []);

  const select = (id: string) => {
    setActive(id);
    document.documentElement.setAttribute('data-color-theme', id);
    localStorage.setItem('color-theme', id);
  };

  const toggleMode = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setIsDark(!isDark);

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (!reduceMotion) {
      document.body.classList.remove('theme-flash-active');
      requestAnimationFrame(() => {
        document.body.classList.add('theme-flash-active');
        setTimeout(() => {
          document.body.classList.remove('theme-flash-active');
        }, 520);
      });
    }
  }, [isDark]);

  return (
    <div className="theme-bar">
      <span className="theme-bar-label">Theme</span>
      <div className="theme-bar-swatches">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-swatch ${active === t.id ? 'is-active' : ''}`}
            style={{ '--swatch-color': t.color } as React.CSSProperties}
            onClick={() => select(t.id)}
            aria-label={`${t.label} theme`}
            title={t.label}
          >
            <span className="theme-swatch-tooltip">{t.label}</span>
          </button>
        ))}
      </div>
      <span className="theme-bar-divider" />
      <button
        className="theme-bar-mode-toggle"
        onClick={toggleMode}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        <svg
          className="theme-bar-mode-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isDark ? (
            <>
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </>
          ) : (
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          )}
        </svg>
      </button>
    </div>
  );
}
