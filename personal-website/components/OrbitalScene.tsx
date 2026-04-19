'use client';

import { useEffect, useRef } from 'react';
import {
  PLANETS,
  SCENE_CENTER,
  SCENE_SIZE,
  type OrbitalPlanetKind,
  type OrbitalSectionId,
  type OrbitalSectionMeta,
} from '@/lib/orbitalData';

type OrbitalSceneProps = {
  activeId: OrbitalSectionId;
  onHover: (id: OrbitalSectionId | null) => void;
  onSelect: (id: OrbitalSectionId) => void;
  reducedMotion: boolean;
};

const TWO_PI = Math.PI * 2;

// Approximate visible radii of each planet sprite (matches the CSS sizes
// in .orb-planet.kind-*, padded slightly so the click target feels generous).
const KIND_HIT_RADIUS: Record<OrbitalPlanetKind, number> = {
  home: 16,
  about: 22,
  projects: 30,
  writing: 20,
  contact: 13,
};

type FramePosition = {
  sx: number;
  sy: number;
  scale: number;
  z: number;
  opacity: number;
  blur: number;
};

type Positions = Record<OrbitalSectionId, FramePosition>;
type BodyRefs = Record<OrbitalSectionId, HTMLButtonElement | null>;
type Cursor = { x: number; y: number } | null;

const ZERO_FRAME: FramePosition = {
  sx: 0,
  sy: 0,
  scale: 1,
  z: 0,
  opacity: 1,
  blur: 0,
};

function createInitialPositions(): Positions {
  return {
    home: { ...ZERO_FRAME },
    about: { ...ZERO_FRAME },
    projects: { ...ZERO_FRAME },
    blog: { ...ZERO_FRAME },
    contact: { ...ZERO_FRAME },
  };
}

function createInitialBodyRefs(): BodyRefs {
  return {
    home: null,
    about: null,
    projects: null,
    blog: null,
    contact: null,
  };
}

function computeFrame(
  planet: OrbitalSectionMeta,
  elapsed: number,
): FramePosition {
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
  return { sx, sy, scale, z, opacity, blur };
}

function applyFrameToBody(
  body: HTMLButtonElement,
  { sx, sy, scale, z, opacity, blur }: FramePosition,
): void {
  body.style.transform = `translate(calc(-50% + ${sx.toFixed(2)}px), calc(-50% + ${sy.toFixed(2)}px)) scale(${scale.toFixed(3)})`;
  body.style.opacity = opacity.toFixed(3);
  // Base offset of 300 keeps every planet above the surrounding
  // .orb-shell content (z-index 0) even at the deepest part of an
  // inclined orbit, so hit-testing isn't shadowed by transparent
  // siblings (Planet V's z reaches -149, Planet III's -112).
  body.style.zIndex = String(300 + Math.round(z));
  body.style.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : '';
}

function stepFrame(
  bodies: BodyRefs,
  positions: Positions,
  elapsed: number,
): void {
  for (const planet of PLANETS) {
    const body = bodies[planet.id];
    if (!body) {
      continue;
    }
    const frame = computeFrame(planet, elapsed);
    applyFrameToBody(body, frame);
    positions[planet.id] = frame;
  }
}

function hitTest(
  positions: Positions,
  x: number,
  y: number,
): OrbitalSectionId | null {
  let bestId: OrbitalSectionId | null = null;
  let bestZ = -Infinity;
  for (const planet of PLANETS) {
    const pos = positions[planet.id];
    const radius = KIND_HIT_RADIUS[planet.kind] * pos.scale;
    const dx = x - pos.sx;
    const dy = y - pos.sy;
    if (dx * dx + dy * dy <= radius * radius && pos.z > bestZ) {
      bestZ = pos.z;
      bestId = planet.id;
    }
  }
  return bestId;
}

function cursorFromEvent(
  scene: HTMLElement,
  event: MouseEvent,
): { x: number; y: number } {
  const rect = scene.getBoundingClientRect();
  const scale = rect.width > 0 ? SCENE_SIZE / rect.width : 1;
  return {
    x: (event.clientX - rect.left - rect.width / 2) * scale,
    y: (event.clientY - rect.top - rect.height / 2) * scale,
  };
}

export function OrbitalScene({
  activeId,
  onHover,
  onSelect,
  reducedMotion,
}: OrbitalSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const bodyRefs = useRef<BodyRefs>(createInitialBodyRefs());
  const positionsRef = useRef<Positions>(createInitialPositions());
  const cursorRef = useRef<Cursor>(null);
  const hoverIdRef = useRef<OrbitalSectionId | null>(null);

  // Latest onHover without retriggering the animation effect on every render.
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  const emitHover = (next: OrbitalSectionId | null) => {
    if (hoverIdRef.current === next) {
      return;
    }
    hoverIdRef.current = next;
    onHoverRef.current(next);
  };

  // Animation loop — also re-runs the hit test every frame so a stationary
  // cursor releases hover when the planet drifts away (native :hover and
  // mouseenter/mouseleave only update on actual cursor movement).
  useEffect(() => {
    const start = performance.now();

    const syncHoverFromCursor = () => {
      const cursor = cursorRef.current;
      emitHover(
        cursor ? hitTest(positionsRef.current, cursor.x, cursor.y) : null,
      );
    };

    if (reducedMotion) {
      stepFrame(bodyRefs.current, positionsRef.current, 0);
      syncHoverFromCursor();
      return;
    }

    let raf = requestAnimationFrame(function tick(now) {
      stepFrame(bodyRefs.current, positionsRef.current, (now - start) / 1000);
      syncHoverFromCursor();
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  // Pointer wiring on the scene root. Hit-testing happens here (via the
  // shared positions ref) instead of on individual buttons, so negative
  // z-index quirks at the back of inclined orbits can't shadow clicks.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    const observer = new ResizeObserver(() => {
      const rect = scene.getBoundingClientRect();
      const scale = rect.width > 0 ? rect.width / SCENE_SIZE : 1;
      scene.style.setProperty('--scene-scale', scale.toString());
    });
    observer.observe(scene);

    const handleMove = (event: MouseEvent) => {
      const cursor = cursorFromEvent(scene, event);
      cursorRef.current = cursor;
      emitHover(hitTest(positionsRef.current, cursor.x, cursor.y));
    };

    const handleLeave = () => {
      cursorRef.current = null;
      emitHover(null);
    };

    scene.addEventListener('mousemove', handleMove);
    scene.addEventListener('mouseleave', handleLeave);
    return () => {
      observer.disconnect();
      scene.removeEventListener('mousemove', handleMove);
      scene.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <div className="orb-scene" ref={sceneRef} aria-label="Orbital scene">
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
