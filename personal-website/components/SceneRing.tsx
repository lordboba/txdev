'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

function getWireColor() {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? '#1a1d24'
    : '#ffffff';
}

function WireRing() {
  const ref = useRef<THREE.Group>(null);
  const line1Ref = useRef<THREE.Line>(null);
  const line2Ref = useRef<THREE.Line>(null);
  const line3Ref = useRef<THREE.Line>(null);
  const matsRef = useRef<THREE.LineBasicMaterial[]>([]);

  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(Math.cos(angle) * 2.8, 0, Math.sin(angle) * 2.8),
      );
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useEffect(() => {
    const wireColor = getWireColor();
    const mat1 = new THREE.LineBasicMaterial({
      color: wireColor,
      transparent: true,
      opacity: 0.06,
    });
    const mat2 = new THREE.LineBasicMaterial({
      color: wireColor,
      transparent: true,
      opacity: 0.03,
    });
    const mat3 = new THREE.LineBasicMaterial({
      color: wireColor,
      transparent: true,
      opacity: 0.02,
    });
    matsRef.current = [mat1, mat2, mat3];

    const l1 = new THREE.Line(geometry, mat1);
    const l2 = new THREE.Line(geometry, mat2);
    l2.rotation.set(0.4, 0.6, 0);
    const l3 = new THREE.Line(geometry, mat3);
    l3.rotation.set(0.8, 0.3, 0.5);

    line1Ref.current = l1;
    line2Ref.current = l2;
    line3Ref.current = l3;

    if (ref.current) {
      ref.current.add(l1, l2, l3);
    }

    const observer = new MutationObserver(() => {
      const c = new THREE.Color(getWireColor());
      matsRef.current.forEach((m) => m.color.copy(c));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      observer.disconnect();
      geometry.dispose();
      mat1.dispose();
      mat2.dispose();
      mat3.dispose();
    };
  }, [geometry]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.08;
      ref.current.rotation.z += delta * 0.05;
    }
  });

  return <group ref={ref} rotation={[0.8, 0, 0.3]} />;
}

export function SceneRing() {
  return (
    <div className="scene-ring-container">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
      >
        <WireRing />
      </Canvas>
    </div>
  );
}
