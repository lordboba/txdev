import { SCENE_CENTER, type OrbitalSectionMeta } from '@/lib/orbitalData';

const TWO_PI = Math.PI * 2;
const ORBIT_PATH_SAMPLES = 144;

export const ORBITAL_AXIS_LIMIT_DEGREES = 90;

export type OrbitalAxisState = {
  tiltX: number;
  tiltY: number;
};

export type OrbitalFrame = {
  sx: number;
  sy: number;
  scale: number;
  z: number;
  opacity: number;
  blur: number;
};

type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export const DEFAULT_ORBITAL_AXIS: OrbitalAxisState = {
  tiltX: 0,
  tiltY: 0,
};

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rotateX({ x, y, z }: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x,
    y: y * cos - z * sin,
    z: y * sin + z * cos,
  };
}

function rotateY({ x, y, z }: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: x * cos + z * sin,
    y,
    z: -x * sin + z * cos,
  };
}

function rotateZ({ x, y, z }: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
    z,
  };
}

function computeOrbitalPoint(
  planet: OrbitalSectionMeta,
  anomaly: number,
  axis: OrbitalAxisState,
): Vector3 {
  const trajectory = planet.trajectory;
  const eccentricity = clamp(trajectory.eccentricity, 0, 0.92);
  const radius =
    (trajectory.semiMajorAxis * (1 - eccentricity * eccentricity)) /
    (1 + eccentricity * Math.cos(anomaly));
  const orientedAnomaly = anomaly + trajectory.periapsis;

  const localPoint = {
    x: radius * Math.cos(orientedAnomaly),
    y: radius * Math.sin(orientedAnomaly),
    z: 0,
  };

  const planetPlanePoint = rotateZ(
    rotateX(localPoint, trajectory.planeTilt),
    trajectory.planeYaw,
  );

  return rotateY(rotateX(planetPlanePoint, axis.tiltX), axis.tiltY);
}

export function computeOrbitalFrame(
  planet: OrbitalSectionMeta,
  elapsed: number,
  axis: OrbitalAxisState,
): OrbitalFrame {
  const anomaly =
    (elapsed / planet.trajectory.period) * TWO_PI + planet.trajectory.phase;
  const point = computeOrbitalPoint(planet, anomaly, axis);
  const maxDepth =
    planet.trajectory.semiMajorAxis * (1 + planet.trajectory.eccentricity);
  const depth = clamp(point.z / maxDepth, -1, 1);
  const normalized = (depth + 1) / 2;
  const scale = 0.74 + 0.4 * normalized;
  const opacity = 0.52 + 0.48 * normalized;
  const blur = depth < -0.28 ? Math.abs(depth + 0.28) * 2.6 : 0;

  return {
    sx: point.x,
    sy: point.y,
    scale,
    z: point.z,
    opacity,
    blur,
  };
}

export function createOrbitPath(
  planet: OrbitalSectionMeta,
  axis: OrbitalAxisState,
  samples = ORBIT_PATH_SAMPLES,
): string {
  const segments: string[] = [];

  for (let index = 0; index <= samples; index += 1) {
    const anomaly = (index / samples) * TWO_PI;
    const point = computeOrbitalPoint(planet, anomaly, axis);
    const command = index === 0 ? 'M' : 'L';

    segments.push(
      `${command} ${(SCENE_CENTER + point.x).toFixed(2)} ${(SCENE_CENTER + point.y).toFixed(2)}`,
    );
  }

  segments.push('Z');
  return segments.join(' ');
}
