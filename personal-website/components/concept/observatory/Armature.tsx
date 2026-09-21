'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ConceptViewId } from '../conceptData';
import { useConceptView } from '../conceptViewStore';
import { damp, dampAngle, usePointerListener } from '../shared/runtime';
import {
  focusForView,
  readPointerX,
  readPointerY,
  readScrollProgress,
  setPointer,
  setTelemetry,
} from './armatureStore';

const RING_COUNT = 6;
const DIM = new THREE.Color('#5a7683');
const SIGNAL = new THREE.Color('#74e0e8');

type CameraTarget = { azimuth: number; elevation: number; distance: number };

const CAMERA: Record<ConceptViewId, CameraTarget> = {
  profile: { azimuth: 0.62, elevation: 0.22, distance: 9.6 },
  work: { azimuth: 0.05, elevation: 0.06, distance: 8.8 },
  signals: { azimuth: -0.85, elevation: 0.42, distance: 10.6 },
  history: { azimuth: 0.5, elevation: 0.34, distance: 9.4 },
};

type RingTarget = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  opacity: number;
  accent: number;
  spin: number;
};

/**
 * One pool of six rings, four configurations. The instrument never gains or
 * loses parts between views — it only re-reads itself from another angle.
 */
function ringTarget(
  view: ConceptViewId,
  index: number,
  focus: number,
): RingTarget {
  const focused = focus === index;

  switch (view) {
    // Nested and turning at incommensurate rates, so the silhouette never
    // returns to a pose you have already seen.
    case 'profile':
      return {
        position: [0, 0, 0],
        rotation: [0.35 + index * 0.33, index * 0.62, 0],
        scale: 0.95 + index * 0.42,
        opacity: 0.92 - index * 0.09,
        accent: index === 2 ? 0.5 : 0,
        spin: (index % 2 === 0 ? 1 : -1) * (0.23 - index * 0.026),
      };

    // Coplanar, spread through depth: one disc per shipped project.
    case 'work': {
      const isProject = index < 4;

      return {
        position: [0, 0, (index - 1.5) * 0.8 + (focused ? 0.9 : 0)],
        rotation: [0, 0, index * 0.16],
        scale: isProject ? (focused ? 2.35 : 1.95) : 0.9,
        opacity: isProject ? (focused ? 1 : 0.5) : 0.1,
        accent: focused ? 1 : 0,
        spin: isProject ? 0.06 : 0.015,
      };
    }

    // Deliberately unresolved: off-axis, scattered, precessing.
    case 'signals':
      return {
        position: [
          Math.sin(index * 2.1) * 1.9,
          Math.cos(index * 1.7) * 1.4,
          Math.sin(index * 0.9) * 1.2,
        ],
        rotation: [index * 0.9, index * 1.3, index * 0.4],
        scale: 0.75 + (index % 3) * 0.4,
        opacity: 0.62,
        accent: 0.35,
        spin: 0.5 + index * 0.11,
      };

    // Collapsed onto a single vertical axis: one ring per era, oldest on top.
    case 'history':
      return {
        position: [0, (2.5 - index) * 0.62, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: focused ? 2.3 : 1.7,
        opacity: focused ? 1 : 0.34,
        accent: focused ? 1 : 0,
        spin: focused ? 0.16 : 0.05,
      };
  }
}

/** A circle drawn as line segments, with major and minor graduation ticks. */
function buildRingGeometry() {
  const segments = 176;
  const ticks = 48;
  const points: number[] = [];

  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    points.push(Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0);
  }

  for (let i = 0; i < ticks; i += 1) {
    const a = (i / ticks) * Math.PI * 2;
    const length = 1 + (i % 4 === 0 ? 0.13 : 0.06);
    points.push(
      Math.cos(a),
      Math.sin(a),
      0,
      Math.cos(a) * length,
      Math.sin(a) * length,
      0,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );

  return geometry;
}

function buildCoreGeometry() {
  const count = 180;
  const positions = new Float32Array(count * 3);

  // Fibonacci sphere — even coverage without clumping at the poles.
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963;

    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return geometry;
}

function ArmatureScene({ reducedMotion }: { reducedMotion: boolean }) {
  // Read the shared stores directly rather than mirroring them through the
  // parent — this component lives in its own reconciler root.
  const view = useConceptView();
  const camera = useThree((state) => state.camera);
  const ringGeometry = useMemo(() => buildRingGeometry(), []);
  const coreGeometry = useMemo(() => buildCoreGeometry(), []);

  const tilts = useRef<(THREE.Group | null)[]>([]);
  const spins = useRef<(THREE.LineSegments | null)[]>([]);
  const core = useRef<THREE.Points>(null);
  const orbit = useRef({ azimuth: 0.62, elevation: 0.22, distance: 9.5 });
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const target = CAMERA[view];
    const lambda = reducedMotion ? 60 : 3.1;
    const focus = focusForView(view);

    const parallaxX = reducedMotion ? 0 : readPointerX() * 0.1;
    const parallaxY = reducedMotion ? 0 : readPointerY() * 0.07;
    const lift = reducedMotion ? 0 : readScrollProgress() * 0.4;

    orbit.current.azimuth = dampAngle(
      orbit.current.azimuth,
      target.azimuth + parallaxX,
      lambda,
      delta,
    );
    orbit.current.elevation = damp(
      orbit.current.elevation,
      target.elevation + lift - parallaxY,
      lambda,
      delta,
    );
    orbit.current.distance = damp(
      orbit.current.distance,
      target.distance,
      lambda,
      delta,
    );

    const { azimuth, elevation, distance } = orbit.current;
    camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance,
      Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(0, 0, 0);

    setTelemetry(azimuth, elevation);

    for (let i = 0; i < RING_COUNT; i += 1) {
      const tilt = tilts.current[i];
      const spin = spins.current[i];

      if (!tilt || !spin) {
        continue;
      }

      const ring = ringTarget(view, i, focus);

      tilt.position.x = damp(tilt.position.x, ring.position[0], lambda, delta);
      tilt.position.y = damp(tilt.position.y, ring.position[1], lambda, delta);
      tilt.position.z = damp(tilt.position.z, ring.position[2], lambda, delta);

      tilt.rotation.x = dampAngle(
        tilt.rotation.x,
        ring.rotation[0],
        lambda,
        delta,
      );
      tilt.rotation.y = dampAngle(
        tilt.rotation.y,
        ring.rotation[1],
        lambda,
        delta,
      );
      tilt.rotation.z = dampAngle(
        tilt.rotation.z,
        ring.rotation[2],
        lambda,
        delta,
      );

      tilt.scale.setScalar(damp(tilt.scale.x, ring.scale, lambda, delta));

      if (!reducedMotion) {
        spin.rotation.z += ring.spin * delta;
      }

      const material = spin.material as THREE.LineBasicMaterial;
      material.opacity = damp(material.opacity, ring.opacity, lambda, delta);
      scratch.copy(DIM).lerp(SIGNAL, ring.accent);
      material.color.lerp(scratch, 1 - Math.exp(-lambda * delta));
    }

    if (core.current) {
      const scattered = view === 'signals';

      core.current.scale.setScalar(
        damp(core.current.scale.x, scattered ? 1.5 : 0.36, lambda, delta),
      );

      if (!reducedMotion) {
        core.current.rotation.y += (scattered ? 0.22 : 0.06) * delta;
      }

      const material = core.current.material as THREE.PointsMaterial;
      material.opacity = damp(
        material.opacity,
        scattered ? 0.8 : 0.45,
        lambda,
        delta,
      );
    }
  });

  return (
    <group>
      {Array.from({ length: RING_COUNT }, (_, index) => (
        <group
          key={index}
          ref={(node) => {
            tilts.current[index] = node;
          }}
        >
          <lineSegments
            geometry={ringGeometry}
            ref={(node) => {
              spins.current[index] = node;
            }}
          >
            {/* Additive so the graduations read as emitted light against the
                ground, and stay visible through the translucent plates. */}
            <lineBasicMaterial
              blending={THREE.AdditiveBlending}
              color={DIM}
              depthWrite={false}
              opacity={0}
              transparent
            />
          </lineSegments>
        </group>
      ))}

      <points geometry={coreGeometry} ref={core}>
        <pointsMaterial
          blending={THREE.AdditiveBlending}
          color={SIGNAL}
          depthWrite={false}
          opacity={0}
          size={0.045}
          sizeAttenuation
          transparent
        />
      </points>
    </group>
  );
}

export function Armature({
  reducedMotion,
  className,
}: {
  reducedMotion: boolean;
  className?: string;
}) {
  usePointerListener(setPointer);

  return (
    <div aria-hidden="true" className={className}>
      <Canvas
        camera={{ fov: 38, position: [0, 0, 9.5], near: 0.1, far: 60 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <ArmatureScene reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
