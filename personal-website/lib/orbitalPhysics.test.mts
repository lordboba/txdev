import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

type Vector3 = [number, number, number];

const MIN_PROJECTED_ORBIT_RATIO = 0.3;

type OrbitalPlane = {
  planeTilt: number;
  planeYaw: number;
};

function readOrbitalPlanes(): OrbitalPlane[] {
  const source = readFileSync(
    fileURLToPath(new URL('./orbitalData.ts', import.meta.url)),
    'utf8',
  );
  const matches = source.matchAll(
    /planeTilt:\s*(-?\d+(?:\.\d+)?),\s*planeYaw:\s*(-?\d+(?:\.\d+)?)/g,
  );

  return Array.from(matches, ([, planeTilt, planeYaw]) => ({
    planeTilt: Number(planeTilt),
    planeYaw: Number(planeYaw),
  }));
}

function rotateX([x, y, z]: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

function rotateY([x, y, z]: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

function rotateZ([x, y, z]: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos, z];
}

function projectedOrbitRatio(
  planeTilt: number,
  planeYaw: number,
  pitchDegrees: number,
  yawDegrees: number,
): number {
  const degreesToRadians = Math.PI / 180;
  const planeNormal = rotateZ(rotateX([0, 0, 1], planeTilt), planeYaw);
  const viewNormal = rotateY(
    rotateX(planeNormal, pitchDegrees * degreesToRadians),
    yawDegrees * degreesToRadians,
  );

  return Math.abs(viewNormal[2]);
}

test('axis controls keep every orbit visibly open across their full range', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./orbitalPhysics.ts', import.meta.url)),
    'utf8',
  );
  const limitMatch = source.match(/ORBITAL_AXIS_LIMIT_DEGREES\s*=\s*(\d+)/);
  const orbitalPlanes = readOrbitalPlanes();

  assert.ok(limitMatch, 'orbital axis limit should be declared');
  assert.ok(orbitalPlanes.length > 0, 'orbital planes should be declared');
  const limit = Number(limitMatch[1]);
  let minimumRatio = 1;

  for (const plane of orbitalPlanes) {
    for (let pitch = -limit; pitch <= limit; pitch += 1) {
      for (let yaw = -limit; yaw <= limit; yaw += 1) {
        minimumRatio = Math.min(
          minimumRatio,
          projectedOrbitRatio(plane.planeTilt, plane.planeYaw, pitch, yaw),
        );
      }
    }
  }

  assert.ok(
    minimumRatio >= MIN_PROJECTED_ORBIT_RATIO,
    `minimum projected orbit ratio ${minimumRatio.toFixed(3)} should be at least ${MIN_PROJECTED_ORBIT_RATIO}`,
  );
});
