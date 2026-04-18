'use client';

import { useEffect, useRef } from 'react';
import {
  PLANETS,
  SCENE_CENTER,
  SCENE_SIZE,
  type OrbitalSectionId,
} from '@/lib/orbitalData';

type OrbitalSceneProps = {
  activeId: OrbitalSectionId;
  onHover: (id: OrbitalSectionId | null) => void;
  onSelect: (id: OrbitalSectionId) => void;
};

const TWO_PI = Math.PI * 2;

export function OrbitalScene({
  activeId,
  onHover,
  onSelect,
}: OrbitalSceneProps) {
  const bodyRefs = useRef<Record<OrbitalSectionId, HTMLButtonElement | null>>({
    home: null,
    about: null,
    projects: null,
    blog: null,
    contact: null,
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    const start = performance.now();

    const apply = (elapsed: number) => {
      for (const planet of PLANETS) {
        const body = bodyRefs.current[planet.id];
        if (!body) {
          continue;
        }

        const phi = (elapsed / planet.period) * TWO_PI + planet.phase;
        const x0 = planet.radius * Math.cos(phi);
        const y0 = planet.radius * Math.sin(phi);
        const y1 = y0 * Math.cos(planet.inclination);
        const z = y0 * Math.sin(planet.inclination);
        const cosYaw = Math.cos(planet.yaw);
        const sinYaw = Math.sin(planet.yaw);
        const sx = cosYaw * x0 - sinYaw * y1;
        const sy = sinYaw * x0 + cosYaw * y1;
        const depth = z / planet.radius;
        const normalized = (depth + 1) / 2;
        const scale = 0.75 + 0.35 * normalized * 1.1;
        const opacity = 0.55 + 0.45 * normalized;
        const blur = depth < -0.3 ? Math.abs(depth + 0.3) * 2.4 : 0;

        body.style.transform = `translate(calc(-50% + ${sx.toFixed(2)}px), calc(-50% + ${sy.toFixed(2)}px)) scale(${scale.toFixed(3)})`;
        body.style.opacity = opacity.toFixed(3);
        body.style.zIndex = String(100 + Math.round(z));
        body.style.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : '';
      }
    };

    if (media.matches) {
      apply(0);
      return;
    }

    const tick = (now: number) => {
      apply((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="orb-scene" aria-label="Orbital scene">
      <div className="orb-star" aria-hidden="true" />

      <svg
        className="orb-rings"
        viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {PLANETS.map((planet) => (
          <ellipse
            key={planet.id}
            cx={SCENE_CENTER}
            cy={SCENE_CENTER}
            rx={planet.radius}
            ry={planet.radius * Math.cos(planet.inclination)}
            transform={`rotate(${((planet.yaw * 180) / Math.PI).toFixed(2)} ${SCENE_CENTER} ${SCENE_CENTER})`}
            className={planet.id === activeId ? 'orb-ring-bright' : undefined}
          />
        ))}
      </svg>

      <div className="orb-bodies">
        {PLANETS.map((planet) => {
          const isActive = planet.id === activeId;

          return (
            <button
              key={planet.id}
              type="button"
              ref={(element) => {
                bodyRefs.current[planet.id] = element;
              }}
              className={`orb-body${isActive ? ' is-active' : ''}`}
              onClick={() => onSelect(planet.id)}
              onMouseEnter={() => onHover(planet.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(planet.id)}
              onBlur={() => onHover(null)}
              aria-label={`${planet.numeral} · ${planet.label}`}
            >
              <span
                className={`orb-planet kind-${planet.kind}`}
                aria-hidden="true"
              />
              <span
                className="orb-tag"
                style={{ ['--tag-offset' as string]: `${planet.tagOffset}px` }}
              >
                {planet.numeral} · {planet.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
