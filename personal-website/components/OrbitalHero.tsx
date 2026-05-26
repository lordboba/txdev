'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { OrbitalAxisControls } from '@/components/OrbitalAxisControls';
import { OrbitalScene } from '@/components/OrbitalScene';
import { SideIndex } from '@/components/SideIndex';
import { VisitorCount } from '@/components/VisitorCount';
import type { ThemeMode } from '@/components/runtime/themePreferences';
import {
  PLANETS,
  PLANET_BY_ID,
  type OrbitalSectionId,
} from '@/lib/orbitalData';
import {
  DEFAULT_ORBITAL_AXIS,
  type OrbitalAxisState,
} from '@/lib/orbitalPhysics';

type AtmosphereSeed = {
  type: 'star' | 'dust' | 'chart';
  left: string;
  top: string;
  size: string;
  opacity: string;
  blur?: string;
  delay: string;
  duration: string;
};

type AtmosphereParticleStyle = CSSProperties & {
  '--orb-particle-left': string;
  '--orb-particle-top': string;
  '--orb-particle-size': string;
  '--orb-particle-opacity': string;
  '--orb-particle-blur': string;
  '--orb-particle-delay': string;
  '--orb-particle-duration': string;
};

type OrbitalHeroProps = {
  selectedId: OrbitalSectionId | null;
  onSelect: (id: OrbitalSectionId) => void;
  themeMode: ThemeMode;
  visitorCount: number | null;
  reducedMotion: boolean;
};

type ExclusionZone = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const LIGHT_EXCLUSION_ZONES: ExclusionZone[] = [
  { left: 10, right: 90, top: 0, bottom: 25 },
  { left: 22, right: 66, top: 24, bottom: 76 },
  { left: 62, right: 100, top: 34, bottom: 90 },
];

function createSeededRandom(seed: number) {
  return function next() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 10000) / 10000;
  };
}

function pickPosition(next: () => number, exclusions: ExclusionZone[]) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const left = 3 + next() * 94;
    const top = 4 + next() * 92;

    const blocked = exclusions.some(
      (zone) =>
        left >= zone.left &&
        left <= zone.right &&
        top >= zone.top &&
        top <= zone.bottom,
    );

    if (!blocked) {
      return { left, top };
    }
  }

  return {
    left: 3 + next() * 94,
    top: 4 + next() * 92,
  };
}

function createDarkAtmosphereSeeds(): AtmosphereSeed[] {
  const next = createSeededRandom(42069);

  return Array.from({ length: 90 }, () => {
    const size = (next() * 1.3 + 0.6).toFixed(2);

    return {
      type: 'star',
      left: `${(next() * 100).toFixed(2)}%`,
      top: `${(next() * 100).toFixed(2)}%`,
      size: `${size}px`,
      opacity: (next() * 0.5 + 0.25).toFixed(2),
      delay: `${(next() * 5).toFixed(2)}s`,
      duration: `${(3 + next() * 4).toFixed(2)}s`,
    };
  });
}

function createLightAtmosphereSeeds(): AtmosphereSeed[] {
  const next = createSeededRandom(240418);
  const dust = Array.from({ length: 28 }, () => {
    const point = pickPosition(next, LIGHT_EXCLUSION_ZONES);
    const size = (next() * 1.15 + 0.85).toFixed(2);

    return {
      type: 'dust' as const,
      left: `${point.left.toFixed(2)}%`,
      top: `${point.top.toFixed(2)}%`,
      size: `${size}px`,
      opacity: (next() * 0.18 + 0.12).toFixed(2),
      blur: `${(next() * 1.2 + 0.2).toFixed(2)}px`,
      delay: '0s',
      duration: '0s',
    };
  });

  const chart = Array.from({ length: 8 }, () => {
    const point = pickPosition(next, LIGHT_EXCLUSION_ZONES);
    const size = (next() * 1.5 + 1.9).toFixed(2);

    return {
      type: 'chart' as const,
      left: `${point.left.toFixed(2)}%`,
      top: `${point.top.toFixed(2)}%`,
      size: `${size}px`,
      opacity: (next() * 0.22 + 0.42).toFixed(2),
      blur: `${(next() * 0.24).toFixed(2)}px`,
      delay: '0s',
      duration: '0s',
    };
  });

  return [...dust, ...chart];
}

function createAtmosphereSeeds(mode: ThemeMode): AtmosphereSeed[] {
  return mode === 'light'
    ? createLightAtmosphereSeeds()
    : createDarkAtmosphereSeeds();
}

function getAtmosphereParticleStyle(
  particle: AtmosphereSeed,
): AtmosphereParticleStyle {
  return {
    '--orb-particle-left': particle.left,
    '--orb-particle-top': particle.top,
    '--orb-particle-size': particle.size,
    '--orb-particle-opacity': String(particle.opacity),
    '--orb-particle-blur': particle.blur ? `blur(${particle.blur})` : 'none',
    '--orb-particle-delay': particle.delay,
    '--orb-particle-duration': particle.duration,
  };
}

export function OrbitalHero({
  selectedId,
  onSelect,
  themeMode,
  visitorCount,
  reducedMotion,
}: OrbitalHeroProps) {
  const [hoverId, setHoverId] = useState<OrbitalSectionId | null>(null);
  const [axisControlsOpen, setAxisControlsOpen] = useState(false);
  const [axisState, setAxisState] = useState<OrbitalAxisState>({
    ...DEFAULT_ORBITAL_AXIS,
  });
  const atmosphere = useMemo(
    () => createAtmosphereSeeds(themeMode),
    [themeMode],
  );
  const resetAxis = useCallback(() => {
    setAxisState({ ...DEFAULT_ORBITAL_AXIS });
  }, []);

  const activeId: OrbitalSectionId = hoverId ?? selectedId ?? 'home';
  const activePlanet = PLANET_BY_ID[activeId] ?? PLANETS[0];

  return (
    <>
      <div className="orb-sky" aria-hidden="true" />
      <div className="orb-stars" data-mode={themeMode} aria-hidden="true">
        {atmosphere.map((particle) => (
          <i
            key={`orb-particle-${particle.type}-${particle.left}-${particle.top}-${particle.size}`}
            className={`orb-particle orb-particle-${particle.type}`}
            style={getAtmosphereParticleStyle(particle)}
          />
        ))}
      </div>
      <div className="orb-grain" aria-hidden="true" />

      <div className="orb-shell">
        <div className="orb-stage">
          <div className="orb-hero-head">
            <div className="orb-title">
              <h1>
                Tyler Xiao&apos;s <em>portfolio</em>
              </h1>
              <p className="orb-title-copy" aria-live="polite">
                Selected work across AI systems, backend infrastructure, and
                product engineering.
              </p>
            </div>
            <div className="orb-hero-tools">
              <div className="orb-visitor-secondary">
                <VisitorCount
                  count={visitorCount}
                  reducedMotion={reducedMotion}
                />
              </div>
              <Link href="/terminal" className="terminal-toggle-btn">
                Terminal
                <span className="terminal-toggle-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            </div>
          </div>

          <div className="orb-scene-slot">
            <OrbitalScene
              activeId={activeId}
              axisState={axisState}
              onHover={setHoverId}
              onSelect={onSelect}
              reducedMotion={reducedMotion}
            />
            <div className="orb-active-announce" aria-live="polite">
              {activePlanet.label} · {activePlanet.serial}
            </div>
          </div>

          <div className="orb-side-column">
            <SideIndex
              activeId={activeId}
              onHover={setHoverId}
              onSelect={onSelect}
            />
            <div className="orb-axis-disclosure" data-open={axisControlsOpen}>
              <button
                type="button"
                className="orb-axis-disclosure-toggle"
                aria-expanded={axisControlsOpen}
                onClick={() => setAxisControlsOpen((open) => !open)}
              >
                Orbit controls
                <span aria-hidden="true">{axisControlsOpen ? '-' : '+'}</span>
              </button>
              <OrbitalAxisControls
                axisState={axisState}
                onAxisChange={setAxisState}
                onReset={resetAxis}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
