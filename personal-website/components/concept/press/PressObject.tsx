'use client';

import { Edges } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { ConceptViewId } from '../conceptData';

const INK = '#0c0c0c';
const PAPER = '#f4f2ed';
const ACCENT = '#ff3b1f';

const AXIS: Record<ConceptViewId, [number, number, number]> = {
  profile: [0.35, 1, 0],
  work: [0, 1, 0],
  signals: [1, 0.6, 0.2],
  history: [0, 1, 0],
};

/**
 * A different solid per view rather than a morph. Hard cuts are the point:
 * this concept has no easing curves anywhere, including in 3D.
 */
function Geometry({ view }: { view: ConceptViewId }) {
  switch (view) {
    case 'profile':
      return <icosahedronGeometry args={[1.45, 0]} />;
    case 'work':
      return <boxGeometry args={[1.95, 1.95, 1.95]} />;
    case 'signals':
      return <torusKnotGeometry args={[1.02, 0.33, 140, 14]} />;
    case 'history':
      return <cylinderGeometry args={[1.28, 1.28, 2.1, 6]} />;
  }
}

function Solid({
  view,
  accent,
  reducedMotion,
}: {
  view: ConceptViewId;
  accent: boolean;
  reducedMotion: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!mesh.current || reducedMotion) {
      return;
    }

    // Quantised rotation: the solid indexes in 15° steps six times a second,
    // like a press plate advancing, instead of turning smoothly.
    const step = Math.floor(state.clock.elapsedTime * 6) * (Math.PI / 12);
    const [x, y, z] = AXIS[view];

    mesh.current.rotation.set(step * x, step * y, step * z);
  });

  return (
    <mesh key={view} ref={mesh}>
      <Geometry view={view} />
      <meshBasicMaterial color={accent ? ACCENT : INK} />
      <Edges color={PAPER} />
    </mesh>
  );
}

export function PressObject({
  view,
  accent,
  reducedMotion,
  className,
}: {
  view: ConceptViewId;
  accent: boolean;
  reducedMotion: boolean;
  className: string;
}) {
  return (
    <div aria-hidden="true" className={className}>
      <Canvas
        camera={{ position: [0, 0, 10], zoom: 105 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        orthographic
      >
        <Solid accent={accent} reducedMotion={reducedMotion} view={view} />
      </Canvas>
    </div>
  );
}
