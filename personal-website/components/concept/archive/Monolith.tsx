'use client';

import { Edges } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { ConceptViewId } from '../conceptData';
import { useConceptView } from '../conceptViewStore';
import { damp } from '../shared/runtime';
import {
  advanceMonolith,
  beginDrag,
  dragBy,
  endDrag,
  readHover,
} from './monolithStore';

const STRATA = 6;

const SLAB_WIDTHS = Array.from(
  { length: STRATA },
  (_, index) => 2.15 + Math.sin(index * 1.4) * 0.42,
);

type Stratum = { y: number; x: number; z: number; tilt: number };

/**
 * One stack, four arrangements. The strata never change count — turning the
 * monolith only changes how the same six layers are held apart.
 */
function stratumTarget(
  view: ConceptViewId,
  index: number,
  hover: number,
): Stratum {
  const centred = index - (STRATA - 1) / 2;

  switch (view) {
    case 'profile':
      return { y: centred * 0.46, x: 0, z: 0, tilt: index * 0.012 };

    // Four layers step out sideways — one edge per shipped project.
    case 'work': {
      const project = index - 1;
      const isProject = project >= 0 && project < 4;

      return {
        y: centred * 0.46,
        x: isProject ? (project % 2 === 0 ? -0.7 : 0.7) : 0,
        z: hover === project ? 0.5 : 0,
        tilt: 0,
      };
    }

    case 'signals':
      return {
        y: centred * 0.52 + Math.sin(index * 1.9) * 0.12,
        x: Math.sin(index * 2.4) * 0.4,
        z: Math.cos(index * 1.3) * 0.3,
        tilt: Math.sin(index * 3.1) * 0.14,
      };

    // Pulled apart into a legible section: one layer per recorded era.
    case 'history':
      return {
        y: centred * 0.86,
        x: 0,
        z: hover === index ? 0.65 : 0,
        tilt: 0,
      };
  }
}

function MonolithScene({
  onFace,
  reducedMotion,
}: {
  onFace: (face: number) => void;
  reducedMotion: boolean;
}) {
  const view = useConceptView();
  const group = useRef<THREE.Group>(null);
  const layers = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const step = advanceMonolith(delta, view, reducedMotion);

    if (step.commit !== null) {
      onFace(step.commit);
    }

    if (group.current) {
      group.current.rotation.y = step.angle;
      group.current.rotation.x = damp(
        group.current.rotation.x,
        view === 'signals' ? 0.16 : 0.05,
        2.4,
        delta,
      );
    }

    const lambda = reducedMotion ? 60 : 2.8;
    const hover = readHover();

    for (let i = 0; i < STRATA; i += 1) {
      const layer = layers.current[i];

      if (!layer) {
        continue;
      }

      const target = stratumTarget(view, i, hover);

      layer.position.x = damp(layer.position.x, target.x, lambda, delta);
      layer.position.y = damp(layer.position.y, target.y, lambda, delta);
      layer.position.z = damp(layer.position.z, target.z, lambda, delta);
      layer.rotation.z = damp(layer.rotation.z, target.tilt, lambda, delta);
    }
  });

  return (
    <>
      <fog args={['#08090a', 7.5, 18]} attach="fog" />
      <ambientLight intensity={0.55} />
      <directionalLight intensity={1.6} position={[4, 6, 5]} />
      <directionalLight intensity={0.45} position={[-6, -2, -4]} />

      {/* Held left of centre so the docked column never lands on the object. */}
      <group position={[-1.5, 0, 0]} ref={group} scale={0.92}>
        {SLAB_WIDTHS.map((width, index) => (
          <group
            key={width}
            ref={(node) => {
              layers.current[index] = node;
            }}
          >
            <mesh>
              <boxGeometry args={[width, 0.4, 1.45]} />
              <meshStandardMaterial
                color="#1b2026"
                metalness={0.05}
                roughness={0.78}
              />
              <Edges>
                <lineBasicMaterial color="#e8e3d9" opacity={0.42} transparent />
              </Edges>
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

export function Monolith({
  onFace,
  reducedMotion,
  className,
}: {
  onFace: (face: number) => void;
  reducedMotion: boolean;
  className: string;
}) {
  const drag = useRef({ active: false, lastX: 0, lastTime: 0 });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      active: true,
      lastX: event.clientX,
      lastTime: performance.now(),
    };
    beginDrag();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) {
      return;
    }

    const now = performance.now();
    const deltaAngle = (event.clientX - drag.current.lastX) * 0.008;

    dragBy(deltaAngle, Math.max(16, now - drag.current.lastTime) / 1000);

    drag.current.lastX = event.clientX;
    drag.current.lastTime = now;
  };

  const handlePointerUp = () => {
    if (!drag.current.active) {
      return;
    }

    drag.current.active = false;
    const face = endDrag();

    if (face !== null) {
      onFace(face);
    }
  };

  return (
    <div
      aria-hidden="true"
      className={className}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Canvas
        camera={{ fov: 32, position: [0, 0.6, 8.6], near: 0.1, far: 40 }}
        // Higher than the others: the edge lines are one pixel wide, and they
        // alias badly when the comparison board scales the frame down.
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <MonolithScene onFace={onFace} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
