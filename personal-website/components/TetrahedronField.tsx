'use client';

import { useEffect, useRef, useState } from 'react';

type Vec3 = [number, number, number];

const TETRA_VERTICES: Vec3[] = [
  [1, 1, 1],
  [-1, -1, 1],
  [-1, 1, -1],
  [1, -1, -1],
];

const TETRA_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

const TETRA_FACES: Array<[number, number, number]> = [
  [0, 1, 2],
  [0, 3, 1],
  [0, 2, 3],
  [1, 3, 2],
];

function rotatePoint(
  [x, y, z]: Vec3,
  rx: number,
  ry: number,
  rz: number,
): Vec3 {
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;

  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;

  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return [x3, y3, z2];
}

export function TetrahedronField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    const applyTheme = () => {
      setIsLightTheme(
        document.documentElement.getAttribute('data-theme') === 'light',
      );
    };

    applyTheme();

    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let spinBoost = 0;
    let spinBoostTarget = 0;
    let velocitySmoothed = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastPointerTime = 0;
    let frame = 0;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (timeMs: number) => {
      context.clearRect(0, 0, width, height);

      if (!width || !height) return;

      pointerX += (pointerTargetX - pointerX) * 0.08;
      pointerY += (pointerTargetY - pointerY) * 0.08;
      spinBoost += (spinBoostTarget - spinBoost) * 0.08;
      velocitySmoothed += (0 - velocitySmoothed) * 0.045;

      const spin = 0.08 + spinBoost * 0.92;
      const scrollDepth = Math.min(window.scrollY, window.innerHeight * 1.7);
      const time = prefersReducedMotion ? 0 : timeMs * 0.001;
      const rotateX =
        time * 0.54 * spin + pointerY * 0.78 + scrollDepth * 0.00014;
      const rotateY =
        time * 0.92 * spin + pointerX * 1.28 + scrollDepth * 0.00009;
      const rotateZ = time * 0.38 * spin + pointerX * 0.14;

      const baseScale = Math.min(width, height) * 0.21;
      const centerX = width * 0.52;
      const centerY = height * 0.53 + scrollDepth * 0.05;
      const perspective = 3.6;

      const projected = TETRA_VERTICES.map((vertex) => {
        const [x, y, z] = rotatePoint(vertex, rotateX, rotateY, rotateZ);
        const zDepth = z + perspective;
        const depthScale = perspective / zDepth;
        return {
          x: centerX + x * baseScale * depthScale,
          y: centerY + y * baseScale * depthScale,
          z,
        };
      });

      const edgeColor = isLightTheme
        ? 'rgba(15, 18, 25, 0.84)'
        : 'rgba(255, 255, 255, 0.9)';
      const fillColor = isLightTheme
        ? 'rgba(13, 16, 24, 0.06)'
        : 'rgba(255, 255, 255, 0.07)';
      const farFillColor = isLightTheme
        ? 'rgba(13, 16, 24, 0.025)'
        : 'rgba(255, 255, 255, 0.028)';
      const haloColor = isLightTheme
        ? 'rgba(15, 18, 25, 0.12)'
        : 'rgba(255, 255, 255, 0.16)';

      TETRA_FACES.map((face) => {
        const avgZ =
          (projected[face[0]].z + projected[face[1]].z + projected[face[2]].z) /
          3;
        return { face, avgZ };
      })
        .sort((a, b) => a.avgZ - b.avgZ)
        .forEach(({ face, avgZ }) => {
          context.beginPath();
          context.moveTo(projected[face[0]].x, projected[face[0]].y);
          context.lineTo(projected[face[1]].x, projected[face[1]].y);
          context.lineTo(projected[face[2]].x, projected[face[2]].y);
          context.closePath();
          context.fillStyle = avgZ > 0 ? fillColor : farFillColor;
          context.fill();
        });

      context.lineWidth = 1.25;
      context.strokeStyle = edgeColor;
      context.shadowBlur = 22;
      context.shadowColor = haloColor;

      TETRA_EDGES.forEach(([a, b]) => {
        context.beginPath();
        context.moveTo(projected[a].x, projected[a].y);
        context.lineTo(projected[b].x, projected[b].y);
        context.stroke();
      });

      context.shadowBlur = 0;
    };

    const animate = (timeMs: number) => {
      draw(timeMs);
      frame = requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        pointerTargetX = 0;
        pointerTargetY = 0;
        spinBoostTarget = 0;
        return;
      }

      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      pointerTargetX = Math.max(-0.65, Math.min(0.65, nx));
      pointerTargetY = Math.max(-0.65, Math.min(0.65, ny));

      const now = performance.now();
      if (lastPointerTime > 0) {
        const dt = Math.max(12, now - lastPointerTime);
        const rawDx = event.clientX - lastPointerX;
        const rawDy = event.clientY - lastPointerY;
        const dx = Math.max(-46, Math.min(46, rawDx));
        const dy = Math.max(-46, Math.min(46, rawDy));
        const velocity = Math.hypot(dx, dy) / dt;
        velocitySmoothed += (velocity - velocitySmoothed) * 0.2;
        const centerDistance = Math.min(Math.hypot(nx, ny), 0.72);
        const movementEnergy = Math.max(0, velocitySmoothed - 0.015);
        spinBoostTarget = Math.min(
          0.62,
          movementEnergy * 0.56 + centerDistance * 0.24,
        );
      } else {
        spinBoostTarget = 0.11;
      }

      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      lastPointerTime = now;
    };

    const onPointerIdle = () => {
      pointerTargetX = 0;
      pointerTargetY = 0;
      spinBoostTarget = 0;
      velocitySmoothed = 0;
      lastPointerTime = 0;
    };

    const onResize = () => {
      resize();
      if (prefersReducedMotion) {
        draw(0);
      }
    };

    resize();
    window.addEventListener('resize', onResize);

    if (prefersReducedMotion) {
      draw(0);
    } else {
      frame = requestAnimationFrame(animate);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerleave', onPointerIdle);
      window.addEventListener('scroll', onPointerIdle, { passive: true });
      window.addEventListener('blur', onPointerIdle);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerIdle);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onPointerIdle);
      window.removeEventListener('blur', onPointerIdle);
    };
  }, [isLightTheme]);

  return (
    <div ref={rootRef} className="tetra-field" aria-hidden="true">
      <canvas ref={canvasRef} className="tetra-canvas" />
    </div>
  );
}
