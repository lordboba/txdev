'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  PLANETS,
  SCENE_SIZE,
  type OrbitalPlanetKind,
  type OrbitalSectionId,
} from '@/lib/orbitalData';
import {
  computeOrbitalFrame,
  createOrbitPath,
  type OrbitalAxisState,
  type OrbitalFrame,
} from '@/lib/orbitalPhysics';

type OrbitalSceneProps = {
  activeId: OrbitalSectionId;
  axisState: OrbitalAxisState;
  onHover: (id: OrbitalSectionId | null) => void;
  onSelect: (id: OrbitalSectionId) => void;
  reducedMotion: boolean;
};

// Approximate visible radii of each planet sprite (matches the CSS sizes
// in .orb-planet.kind-*, padded slightly so the click target feels generous).
const KIND_HIT_RADIUS: Record<OrbitalPlanetKind, number> = {
  home: 16,
  about: 22,
  projects: 30,
  writing: 20,
  contact: 13,
};

type Positions = Record<OrbitalSectionId, OrbitalFrame>;
type BodyRefs = Record<OrbitalSectionId, HTMLButtonElement | null>;
type Cursor = { x: number; y: number } | null;

const ZERO_FRAME: OrbitalFrame = {
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

function applyFrameToBody(
  body: HTMLButtonElement,
  { sx, sy, scale, z, opacity, blur }: OrbitalFrame,
): void {
  body.style.transform = `translate(calc(-50% + ${sx.toFixed(2)}px), calc(-50% + ${sy.toFixed(2)}px)) scale(${scale.toFixed(3)})`;
  body.style.opacity = opacity.toFixed(3);
  // Keep far-side planets above the shell while leaving room for near-side
  // planets to pass in front of the star when the global axis is tilted.
  body.style.zIndex = String(500 + Math.round(z));
  body.style.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : '';
}

function stepFrame(
  bodies: BodyRefs,
  positions: Positions,
  elapsed: number,
  axisState: OrbitalAxisState,
): void {
  for (const planet of PLANETS) {
    const body = bodies[planet.id];
    if (!body) {
      continue;
    }
    const frame = computeOrbitalFrame(planet, elapsed, axisState);
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
  axisState,
  onHover,
  onSelect,
  reducedMotion,
}: OrbitalSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const bodyRefs = useRef<BodyRefs>(createInitialBodyRefs());
  const positionsRef = useRef<Positions>(createInitialPositions());
  const cursorRef = useRef<Cursor>(null);
  const hoverIdRef = useRef<OrbitalSectionId | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const orbitPaths = useMemo(
    () =>
      Object.fromEntries(
        PLANETS.map((planet) => [
          planet.id,
          createOrbitPath(planet, axisState),
        ]),
      ) as Record<OrbitalSectionId, string>,
    [axisState],
  );

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
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now();
    }

    const start = startTimeRef.current;

    const syncHoverFromCursor = () => {
      const cursor = cursorRef.current;
      emitHover(
        cursor ? hitTest(positionsRef.current, cursor.x, cursor.y) : null,
      );
    };

    if (reducedMotion) {
      stepFrame(bodyRefs.current, positionsRef.current, 0, axisState);
      syncHoverFromCursor();
      return;
    }

    let raf = requestAnimationFrame(function tick(now) {
      stepFrame(
        bodyRefs.current,
        positionsRef.current,
        (now - start) / 1000,
        axisState,
      );
      syncHoverFromCursor();
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [axisState, reducedMotion]);

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
          <path
            key={planet.id}
            d={orbitPaths[planet.id]}
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
              <span className="orb-body-active-label" aria-hidden="true">
                <span className="name">{planet.label}</span>
                <span className="hint">
                  Click to open <span className="arrow">&#8599;</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
