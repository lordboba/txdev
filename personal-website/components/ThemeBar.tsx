'use client';

import { useState, useEffect } from 'react';

const THEMES = [
  { id: 'mono', label: 'Mono', color: '#ffffff' },
  { id: 'ember', label: 'Ember', color: '#e8a060' },
  { id: 'ice', label: 'Ice', color: '#5090e0' },
  { id: 'terminal', label: 'Terminal', color: '#80e840' },
] as const;

export function ThemeBar() {
  const [active, setActive] = useState('mono');

  useEffect(() => {
    const saved = localStorage.getItem('color-theme');
    if (saved && THEMES.some((t) => t.id === saved)) {
      setActive(saved);
      document.documentElement.setAttribute('data-color-theme', saved);
    }
  }, []);

  const select = (id: string) => {
    setActive(id);
    document.documentElement.setAttribute('data-color-theme', id);
    localStorage.setItem('color-theme', id);
  };

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
    </div>
  );
}
