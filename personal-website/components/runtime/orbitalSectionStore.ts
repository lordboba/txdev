'use client';

import { useSyncExternalStore } from 'react';
import type { OrbitalSectionId } from '@/lib/orbitalData';

const ORBITAL_SECTION_EVENT = 'orbital-section-change';

const HASH_TO_SECTION: Record<string, OrbitalSectionId> = {
  '': 'home',
  '#about': 'about',
  '#projects': 'projects',
  '#blog': 'blog',
  '#contact': 'contact',
};

const SECTION_TO_HASH: Record<OrbitalSectionId, string> = {
  home: '',
  about: '#about',
  projects: '#projects',
  blog: '#blog',
  contact: '#contact',
};

export function getOrbitalSectionHref(sectionId: OrbitalSectionId) {
  const hash = SECTION_TO_HASH[sectionId];
  return hash ? `/${hash}` : '/';
}

function getOrbitalSectionSnapshot(): OrbitalSectionId {
  if (typeof window === 'undefined') {
    return 'home';
  }

  const hash = window.location.hash.toLowerCase();
  return HASH_TO_SECTION[hash] ?? 'home';
}

function subscribeToOrbitalSection(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener(ORBITAL_SECTION_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener(ORBITAL_SECTION_EVENT, onStoreChange);
  };
}

export function useOrbitalSectionId() {
  return useSyncExternalStore<OrbitalSectionId>(
    subscribeToOrbitalSection,
    getOrbitalSectionSnapshot,
    () => 'home',
  );
}

export function setOrbitalSectionId(sectionId: OrbitalSectionId) {
  if (typeof window === 'undefined') {
    return;
  }

  const { pathname, search } = window.location;
  const hash = SECTION_TO_HASH[sectionId];
  const nextUrl = `${pathname}${search}${hash}`;

  window.history.replaceState(window.history.state, '', nextUrl);
  window.dispatchEvent(new Event(ORBITAL_SECTION_EVENT));
}
