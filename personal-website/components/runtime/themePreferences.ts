'use client';

import { useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light';
export type ColorTheme = 'mono' | 'ember' | 'ice' | 'terminal';

export const THEME_EVENT = 'theme-preference-change';

const DEFAULT_THEME_MODE: ThemeMode = 'dark';
const DEFAULT_COLOR_THEME: ColorTheme = 'mono';

function announceThemeChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(THEME_EVENT));
  }
}

function subscribeToThemePreferences(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('storage', onStoreChange);
  window.addEventListener(THEME_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

function subscribeToReducedMotion(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', onStoreChange);

  return () => {
    query.removeEventListener('change', onStoreChange);
  };
}

function isColorTheme(value: string | null): value is ColorTheme {
  return (
    value === 'mono' ||
    value === 'ember' ||
    value === 'ice' ||
    value === 'terminal'
  );
}

function getThemeModeSnapshot(): ThemeMode {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME_MODE;
  }

  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark';
}

function getColorThemeSnapshot(): ColorTheme {
  if (typeof window === 'undefined') {
    return DEFAULT_COLOR_THEME;
  }

  const savedTheme = window.localStorage.getItem('color-theme');
  return isColorTheme(savedTheme) ? savedTheme : DEFAULT_COLOR_THEME;
}

function getReducedMotionSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useThemeMode() {
  return useSyncExternalStore(
    subscribeToThemePreferences,
    getThemeModeSnapshot,
    () => DEFAULT_THEME_MODE,
  );
}

export function useColorTheme() {
  return useSyncExternalStore(
    subscribeToThemePreferences,
    getColorThemeSnapshot,
    () => DEFAULT_COLOR_THEME,
  );
}

export function useIsDarkTheme() {
  return useThemeMode() === 'dark';
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

export function setThemeMode(nextTheme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
  announceThemeChange();
}

export function setColorTheme(nextTheme: ColorTheme) {
  document.documentElement.setAttribute('data-color-theme', nextTheme);
  localStorage.setItem('color-theme', nextTheme);
  announceThemeChange();
}

export function triggerThemeFlash() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  document.body.classList.remove('theme-flash-active');
  requestAnimationFrame(() => {
    document.body.classList.add('theme-flash-active');
    window.setTimeout(() => {
      document.body.classList.remove('theme-flash-active');
    }, 520);
  });
}
