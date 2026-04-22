export type OrbitalSectionId =
  | 'home'
  | 'about'
  | 'projects'
  | 'blog'
  | 'contact';

export type OrbitalPlanetKind =
  | 'home'
  | 'about'
  | 'projects'
  | 'writing'
  | 'contact';

export type OrbitalTrajectory = {
  semiMajorAxis: number;
  eccentricity: number;
  planeTilt: number;
  planeYaw: number;
  periapsis: number;
  period: number;
  phase: number;
};

export type OrbitalSectionMeta = {
  id: OrbitalSectionId;
  kind: OrbitalPlanetKind;
  label: string;
  numeral: 'I' | 'II' | 'III' | 'IV' | 'V';
  meta: string;
  serial: string;
  note: string;
  tagOffset: number;
  trajectory: OrbitalTrajectory;
};

export const PLANETS: OrbitalSectionMeta[] = [
  {
    id: 'home',
    kind: 'home',
    label: 'Atlas',
    numeral: 'I',
    meta: 'core',
    serial: 'No. I · central orbit',
    note: 'Core node with the current focus and identity.',
    tagOffset: 24,
    trajectory: {
      semiMajorAxis: 115,
      eccentricity: 0.05,
      planeTilt: 0.34,
      planeYaw: -0.3,
      periapsis: 0.18,
      period: 22,
      phase: 0.4,
    },
  },
  {
    id: 'about',
    kind: 'about',
    label: 'Profile',
    numeral: 'II',
    meta: 'timeline',
    serial: 'No. II · context orbit',
    note: 'Trajectory from UCLA systems work into product architecture.',
    tagOffset: 30,
    trajectory: {
      semiMajorAxis: 165,
      eccentricity: 0.09,
      planeTilt: 0.42,
      planeYaw: 0.24,
      periapsis: -0.28,
      period: 38,
      phase: 2.1,
    },
  },
  {
    id: 'projects',
    kind: 'projects',
    label: 'Projects',
    numeral: 'III',
    meta: 'builds',
    serial: 'No. III · active payloads',
    note: 'Portfolio of shipped experiments, from tools to full systems.',
    tagOffset: 36,
    trajectory: {
      semiMajorAxis: 225,
      eccentricity: 0.13,
      planeTilt: 0.52,
      planeYaw: -0.1,
      periapsis: 0.46,
      period: 66,
      phase: 3.2,
    },
  },
  {
    id: 'blog',
    kind: 'writing',
    label: 'Insights',
    numeral: 'IV',
    meta: 'signals',
    serial: 'No. IV · signal stream',
    note: 'Notes on AI systems, taste, and practical engineering.',
    tagOffset: 28,
    trajectory: {
      semiMajorAxis: 285,
      eccentricity: 0.17,
      planeTilt: 0.28,
      planeYaw: 0.38,
      periapsis: -0.62,
      period: 102,
      phase: 1.6,
    },
  },
  {
    id: 'contact',
    kind: 'contact',
    label: 'Connect',
    numeral: 'V',
    meta: 'channel',
    serial: 'No. V · direct line',
    note: 'Open channel for collaboration, reviews, and long-form work.',
    tagOffset: 22,
    trajectory: {
      semiMajorAxis: 335,
      eccentricity: 0.21,
      planeTilt: 0.46,
      planeYaw: -0.22,
      periapsis: 0.74,
      period: 160,
      phase: 5.0,
    },
  },
];

export const SCENE_SIZE = 700;
export const SCENE_CENTER = SCENE_SIZE / 2;

export const PLANET_BY_ID = Object.fromEntries(
  PLANETS.map((planet) => [planet.id, planet]),
) as Record<OrbitalSectionId, OrbitalSectionMeta>;
