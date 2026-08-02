'use client';

import { ContactShadows, RoundedBox, useTexture } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  experiments,
  featuredProjects,
  gitEras,
  personalNotes,
  type ConceptViewId,
  type FeaturedProject,
} from '../conceptData';
import { useConceptView } from '../conceptViewStore';
import { damp, dampAngle, usePointerListener } from '../shared/runtime';
import {
  clearBenchSelection,
  readBenchFocus,
  readBenchPointer,
  setBenchHover,
  setBenchPointer,
  setBenchSelection,
} from './benchStore';

const INK = '#141517';
const ALUMINUM = '#a9abad';
const SCREEN = '#090a0b';
const PHONE_TITLES = new Set(['iCalarms', 'Charades 2026']);
const SCREEN_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SCREEN_FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform vec2 uTexel;
  uniform float uBlur;
  varying vec2 vUv;

  void main() {
    vec2 stepSize = uTexel * uBlur;
    vec4 color = texture2D(uTexture, vUv) * 0.24;
    color += texture2D(uTexture, vUv + vec2(stepSize.x, 0.0)) * 0.12;
    color += texture2D(uTexture, vUv - vec2(stepSize.x, 0.0)) * 0.12;
    color += texture2D(uTexture, vUv + vec2(0.0, stepSize.y)) * 0.12;
    color += texture2D(uTexture, vUv - vec2(0.0, stepSize.y)) * 0.12;
    color += texture2D(uTexture, vUv + stepSize) * 0.07;
    color += texture2D(uTexture, vUv - stepSize) * 0.07;
    color += texture2D(uTexture, vUv + vec2(stepSize.x, -stepSize.y)) * 0.07;
    color += texture2D(uTexture, vUv + vec2(-stepSize.x, stepSize.y)) * 0.07;
    gl_FragColor = color;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Transform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

const PROJECT_WORK: Transform[] = [
  { position: [-3.2, 0.15, 0.3], rotation: [0, 0.18, -0.08], scale: 0.78 },
  { position: [-1.05, 0.12, -1.5], rotation: [0, -0.06, 0.025], scale: 0.8 },
  { position: [2.1, 0.12, -1.25], rotation: [0, -0.12, 0.04], scale: 0.8 },
  { position: [3.55, 0.15, 0.65], rotation: [0, -0.22, 0.1], scale: 0.78 },
];

const PROJECT_PROFILE: Transform[] = [
  { position: [-5.2, -0.05, -2.5], rotation: [0, 0.2, -0.2], scale: 0.53 },
  { position: [-4.5, -0.05, 1.9], rotation: [0, -0.12, 0.06], scale: 0.5 },
  { position: [4.5, -0.05, 1.9], rotation: [0, 0.12, -0.06], scale: 0.5 },
  { position: [5.2, -0.05, -2.5], rotation: [0, -0.2, 0.2], scale: 0.53 },
];

const PROJECT_SIGNALS: Transform[] = [
  { position: [-5.2, -0.02, -2.4], rotation: [0, 0.18, -0.18], scale: 0.38 },
  { position: [-4.6, -0.02, 2.1], rotation: [0, -0.1, 0.05], scale: 0.36 },
  { position: [4.6, -0.02, 2.1], rotation: [0, 0.1, -0.05], scale: 0.36 },
  { position: [5.2, -0.02, -2.4], rotation: [0, -0.18, 0.18], scale: 0.38 },
];

const HIDDEN: Transform = {
  position: [0, -2.8, 3.5],
  rotation: [0, 0, 0],
  scale: 0.08,
};

const PALETTE_COLORS: Record<string, string> = {
  paper: '#e7e1d5',
  ink: '#242424',
  rust: '#955a43',
  charcoal: '#303234',
  phosphor: '#bad28c',
  night: '#1c222b',
  'signal gold': '#c4a55f',
  dusk: '#62565b',
  brass: '#a58b5b',
  sage: '#7f907d',
  umber: '#654839',
  parchment: '#ded0ac',
  gold: '#b99953',
  'screen color': '#8ba2aa',
};

function useConfiguredTextures(paths: string[]) {
  const textures = useTexture(paths);

  return useMemo(
    () =>
      textures.map((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
      }),
    [textures],
  );
}

function createTextTexture(
  lines: string[],
  options?: { background?: string; color?: string; size?: number },
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  if (options?.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.fillStyle = options?.color ?? INK;
  context.font = `500 ${options?.size ?? 40}px Helvetica Neue, Arial, sans-serif`;
  context.textBaseline = 'middle';

  lines.forEach((line, index) => {
    const rowHeight = canvas.height / lines.length;
    context.fillText(line, 32, rowHeight * (index + 0.5), canvas.width - 64);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPaletteTexture(palette: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 432;
  const context = canvas.getContext('2d');
  const names = palette.split('/').map((name) => name.trim().toLowerCase());

  if (context) {
    const stripe = canvas.width / names.length;
    names.forEach((name, index) => {
      const color = PALETTE_COLORS[name];

      if (!color) {
        throw new Error(`Bench palette token is not mapped: ${name}`);
      }

      context.fillStyle = color;
      context.fillRect(index * stripe, 0, stripe + 1, canvas.height);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function ScreenTexture({
  texture,
  materialRef,
}: {
  texture: THREE.Texture;
  materialRef: (node: THREE.ShaderMaterial | null) => void;
}) {
  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTexel: { value: new THREE.Vector2(1 / 1600, 1 / 900) },
      uBlur: { value: 0 },
    }),
    [texture],
  );

  return (
    <shaderMaterial
      fragmentShader={SCREEN_FRAGMENT_SHADER}
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={SCREEN_VERTEX_SHADER}
    />
  );
}

function dampTransform(
  group: THREE.Group,
  target: Transform,
  lambda: number,
  delta: number,
) {
  group.position.x = damp(group.position.x, target.position[0], lambda, delta);
  group.position.y = damp(group.position.y, target.position[1], lambda, delta);
  group.position.z = damp(group.position.z, target.position[2], lambda, delta);
  group.rotation.x = dampAngle(
    group.rotation.x,
    target.rotation[0],
    lambda,
    delta,
  );
  group.rotation.y = dampAngle(
    group.rotation.y,
    target.rotation[1],
    lambda,
    delta,
  );
  group.rotation.z = dampAngle(
    group.rotation.z,
    target.rotation[2],
    lambda,
    delta,
  );
  group.scale.setScalar(damp(group.scale.x, target.scale, lambda, delta));
}

function ProjectDevice({
  project,
  texture,
  index,
  deviceRef,
  materialRef,
}: {
  project: FeaturedProject;
  texture: THREE.Texture;
  index: number;
  deviceRef: (node: THREE.Group | null) => void;
  materialRef: (node: THREE.ShaderMaterial | null) => void;
}) {
  const phone = PHONE_TITLES.has(project.title);
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setBenchSelection('work', index);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchHover('work', index);
      }}
      onPointerLeave={() => {
        setBenchHover('work', -1);
      }}
      position={HIDDEN.position}
      ref={deviceRef}
      scale={HIDDEN.scale}
    >
      {phone ? (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <RoundedBox
            args={[1.55, 3.35, 0.18]}
            castShadow
            radius={0.16}
            smoothness={5}
          >
            <meshStandardMaterial
              color={INK}
              metalness={0.55}
              roughness={0.3}
            />
          </RoundedBox>
          <mesh position={[0, 0, 0.096]}>
            <planeGeometry args={[1.4, 3.14]} />
            <meshStandardMaterial color={SCREEN} roughness={0.34} />
          </mesh>
          <mesh position={[0, 0, 0.103]}>
            <planeGeometry args={[1.4, 0.7875]} />
            <ScreenTexture materialRef={materialRef} texture={texture} />
          </mesh>
        </group>
      ) : (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <RoundedBox
            args={[3.35, 2.02, 0.13]}
            castShadow
            radius={0.08}
            smoothness={4}
          >
            <meshStandardMaterial
              color="#858789"
              metalness={0.72}
              roughness={0.27}
            />
          </RoundedBox>
          <mesh position={[0, 0, 0.071]}>
            <planeGeometry args={[3.18, 1.789]} />
            <ScreenTexture materialRef={materialRef} texture={texture} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function ProfileBadge({
  badgeRef,
}: {
  badgeRef: (node: THREE.Group | null) => void;
}) {
  const portrait = useConfiguredTextures(['/pfp.JPG'])[0];
  const coveredPortrait = useMemo(() => {
    const texture = portrait.clone();
    const image = portrait.image as { width?: number; height?: number };
    const sourceAspect = (image.width ?? 3) / (image.height ?? 2);
    const targetAspect = 2 / 3;

    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    if (sourceAspect > targetAspect) {
      texture.repeat.x = targetAspect / sourceAspect;
      texture.offset.x = (1 - texture.repeat.x) / 2;
    } else {
      texture.repeat.y = sourceAspect / targetAspect;
      texture.offset.y = (1 - texture.repeat.y) / 2;
    }

    texture.needsUpdate = true;
    return texture;
  }, [portrait]);
  const notesTexture = useMemo(
    () => createTextTexture(personalNotes, { size: 31 }),
    [],
  );

  return (
    <group position={HIDDEN.position} ref={badgeRef} scale={HIDDEN.scale}>
      <mesh position={[-0.82, 0.08, -3.15]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.13, 0.05, 2.2]} />
        <meshStandardMaterial color={INK} roughness={0.68} />
      </mesh>
      <mesh position={[0.82, 0.08, -3.15]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.13, 0.05, 2.2]} />
        <meshStandardMaterial color={INK} roughness={0.68} />
      </mesh>
      <mesh castShadow position={[0, 0.13, 0]}>
        <boxGeometry args={[3.15, 0.17, 4.5]} />
        <meshStandardMaterial color="#e7e7e5" roughness={0.48} />
      </mesh>
      <mesh position={[-0.73, 0.223, -0.68]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.12, 1.68]} />
        <meshStandardMaterial map={coveredPortrait} roughness={0.5} />
      </mesh>
      <mesh position={[0.35, 0.224, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.25, 1.25]} />
        <meshBasicMaterial map={notesTexture} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.31, -2.15]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.18, 0.045, 10, 32]} />
        <meshStandardMaterial color={INK} metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  );
}

function ExperimentBlank({
  index,
  blankRef,
}: {
  index: number;
  blankRef: (node: THREE.Group | null) => void;
}) {
  const experiment = experiments[index];
  const stamp = useMemo(
    () =>
      createTextTexture([experiment.status.toUpperCase()], {
        color: INK,
        size: 52,
      }),
    [experiment.status],
  );

  return (
    <group
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchHover('signals', index);
      }}
      onPointerLeave={() => setBenchHover('signals', -1)}
      position={HIDDEN.position}
      ref={blankRef}
      scale={HIDDEN.scale}
    >
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <RoundedBox
          args={[2.2, 3.15, 0.16]}
          castShadow
          radius={0.12}
          smoothness={4}
        >
          <meshStandardMaterial
            color={ALUMINUM}
            metalness={0.82}
            roughness={0.31}
            wireframe={index === 1}
          />
        </RoundedBox>
        <mesh position={[0, 0, 0.092]}>
          <planeGeometry args={[1.86, 0.46]} />
          <meshBasicMaterial map={stamp} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function HistoryArtifact({
  index,
  artifactRef,
}: {
  index: number;
  artifactRef: (node: THREE.Group | null) => void;
}) {
  const era = gitEras[index];
  const palette = useMemo(
    () => createPaletteTexture(era.palette),
    [era.palette],
  );
  const label = useMemo(
    () => createTextTexture([era.visualLanguage], { size: 40 }),
    [era.visualLanguage],
  );

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setBenchSelection('history', index);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setBenchHover('history', index);
      }}
      onPointerLeave={() => setBenchHover('history', -1)}
      position={HIDDEN.position}
      ref={artifactRef}
      scale={HIDDEN.scale}
    >
      <mesh castShadow position={[0, 0.08, -0.18]}>
        <boxGeometry args={[1.72, 0.1, 1.07]} />
        <meshStandardMaterial
          color="#727476"
          metalness={0.55}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0.136, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.62, 0.91]} />
        <meshBasicMaterial map={palette} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.137, 0.53]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.72, 0.35]} />
        <meshBasicMaterial map={label} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({
  initialView,
  reducedMotion,
  mobile,
}: {
  initialView?: ConceptViewId;
  reducedMotion: boolean;
  mobile: boolean;
}) {
  const view = useConceptView(initialView);
  const projectTextures = useConfiguredTextures(
    featuredProjects.map((project) => project.image),
  );
  const projects = useRef<(THREE.Group | null)[]>([]);
  const projectMaterials = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const blanks = useRef<(THREE.Group | null)[]>([]);
  const artifacts = useRef<(THREE.Group | null)[]>([]);
  const badge = useRef<THREE.Group | null>(null);
  const cameraLook = useRef(new THREE.Vector3());

  useFrame(({ camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const lambda = reducedMotion ? 80 : 3.2;
    const workFocus = readBenchFocus('work');
    const signalFocus = readBenchFocus('signals');
    const historyFocus = readBenchFocus('history');
    const pointer = readBenchPointer();

    projects.current.forEach((project, index) => {
      if (!project) {
        return;
      }

      let target = HIDDEN;
      if (view === 'work') {
        const active =
          workFocus.hovered === index || workFocus.selected === index;
        const base = PROJECT_WORK[index];
        target = {
          position: [
            base.position[0],
            base.position[1] + (active ? 0.42 : 0),
            base.position[2],
          ],
          rotation: [
            active ? -0.1 : base.rotation[0],
            base.rotation[1],
            base.rotation[2] + (active ? (index < 2 ? 0.1 : -0.1) : 0),
          ],
          scale: base.scale * (active ? 1.08 : 1),
        };
      } else if (view === 'profile') {
        target = PROJECT_PROFILE[index];
      } else if (view === 'signals') {
        target = PROJECT_SIGNALS[index];
      }
      dampTransform(project, target, lambda, delta);

      const screenMaterial = projectMaterials.current[index];
      if (screenMaterial) {
        const blurTarget = view === 'profile' ? 6 : view === 'signals' ? 3 : 0;
        screenMaterial.uniforms.uBlur.value = damp(
          screenMaterial.uniforms.uBlur.value as number,
          blurTarget,
          lambda,
          delta,
        );
      }
    });

    blanks.current.forEach((blank, index) => {
      if (!blank) {
        return;
      }
      const active = signalFocus.hovered === index;
      const target =
        view === 'signals'
          ? {
              position: [
                (index - 1) * 2.8,
                0.15 + (active ? 0.34 : 0),
                index === 1 ? -0.7 : 0.35,
              ] as [number, number, number],
              rotation: [0, (index - 1) * -0.16, (index - 1) * 0.08] as [
                number,
                number,
                number,
              ],
              scale: active ? 0.92 : 0.84,
            }
          : HIDDEN;
      dampTransform(blank, target, lambda, delta);
    });

    artifacts.current.forEach((artifact, index) => {
      if (!artifact) {
        return;
      }
      const active =
        historyFocus.hovered === index || historyFocus.selected === index;
      const target =
        view === 'history'
          ? {
              position: [
                (index - (gitEras.length - 1) / 2) * 1.78,
                0.13 + (active ? 0.25 : 0),
                0,
              ] as [number, number, number],
              rotation: [0, 0, 0] as [number, number, number],
              scale: active ? 1.04 : 0.88,
            }
          : HIDDEN;
      dampTransform(artifact, target, lambda, delta);
    });

    if (badge.current) {
      dampTransform(
        badge.current,
        view === 'profile'
          ? {
              position: [0, 0.14, -0.2],
              rotation: [0, -0.03, -0.04],
              scale: 0.9,
            }
          : HIDDEN,
        lambda,
        delta,
      );
    }

    const selectedProject =
      view === 'work' && workFocus.selected >= 0
        ? PROJECT_WORK[workFocus.selected]
        : null;
    const historyIndex =
      historyFocus.hovered >= 0
        ? historyFocus.hovered
        : historyFocus.selected >= 0
          ? historyFocus.selected
          : (gitEras.length - 1) / 2;
    const historyX = (historyIndex - (gitEras.length - 1) / 2) * 1.35;
    const parallaxX = mobile || reducedMotion ? 0 : pointer.x * 0.34;
    const parallaxY = mobile || reducedMotion ? 0 : pointer.y * 0.18;

    const cameraTargets: Record<ConceptViewId, [number, number, number]> =
      mobile
        ? {
            work: [
              (selectedProject?.position[0] ?? 0) * 0.24,
              selectedProject ? 7.4 : 10,
              selectedProject ? 9.5 : 12.5,
            ],
            profile: [0, 9, 10.8],
            signals: [0, 9, 11.5],
            history: [historyX, 8, 11.5],
          }
        : {
            work: [
              (selectedProject?.position[0] ?? 0) * 0.38 + parallaxX,
              selectedProject ? 5.25 : 7.25,
              selectedProject ? 6.2 : 8.6,
            ],
            profile: [parallaxX * 0.4, 6.4, 7.4],
            signals: [parallaxX, 6.5, 8.2],
            history: [historyX + parallaxX * 0.25, 5.5, 7.2],
          };
    const [cameraX, cameraY, cameraZ] = cameraTargets[view];

    camera.position.x = damp(camera.position.x, cameraX, lambda, delta);
    camera.position.y = damp(
      camera.position.y,
      cameraY - parallaxY,
      lambda,
      delta,
    );
    camera.position.z = damp(camera.position.z, cameraZ, lambda, delta);

    const lookX =
      view === 'history'
        ? historyX
        : selectedProject
          ? selectedProject.position[0] * 0.72
          : 0;
    cameraLook.current.x = damp(cameraLook.current.x, lookX, lambda, delta);
    cameraLook.current.y = damp(cameraLook.current.y, 0, lambda, delta);
    cameraLook.current.z = damp(cameraLook.current.z, 0, lambda, delta);
    camera.lookAt(cameraLook.current);
  });

  return (
    <>
      <color attach="background" args={['#d9dbdd']} />
      <fog attach="fog" args={['#d9dbdd', 10, 19]} />
      <ambientLight intensity={1.55} />
      <directionalLight
        castShadow
        intensity={2.7}
        position={[-4, 9, 5]}
        shadow-bias={-0.0002}
        shadow-mapSize={[1024, 1024]}
      />
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[30, 0.16, 22]} />
        <meshStandardMaterial color="#c9cbcd" roughness={0.92} />
      </mesh>

      {featuredProjects.map((project, index) => (
        <ProjectDevice
          deviceRef={(node) => {
            projects.current[index] = node;
          }}
          index={index}
          key={project.title}
          materialRef={(node) => {
            projectMaterials.current[index] = node;
          }}
          project={project}
          texture={projectTextures[index]}
        />
      ))}

      <ProfileBadge
        badgeRef={(node) => {
          badge.current = node;
        }}
      />

      {experiments.map((experiment, index) => (
        <ExperimentBlank
          blankRef={(node) => {
            blanks.current[index] = node;
          }}
          index={index}
          key={experiment.number}
        />
      ))}

      {gitEras.map((era, index) => (
        <HistoryArtifact
          artifactRef={(node) => {
            artifacts.current[index] = node;
          }}
          index={index}
          key={era.commit}
        />
      ))}

      <ContactShadows
        blur={2.6}
        far={9}
        opacity={0.28}
        position={[0, 0.015, 0]}
        resolution={512}
        scale={22}
      />
    </>
  );
}

export function BenchScene({
  className,
  initialView,
  reducedMotion,
  mobile,
}: {
  className?: string;
  initialView?: ConceptViewId;
  reducedMotion: boolean;
  mobile: boolean;
}) {
  usePointerListener(setBenchPointer);

  return (
    <div className={className}>
      <Canvas
        camera={{ fov: 38, near: 0.1, far: 50, position: [0, 7.25, 8.6] }}
        dpr={[1, 1.75]}
        gl={{ alpha: false, antialias: true }}
        onPointerMissed={clearBenchSelection}
        shadows
      >
        <Scene
          initialView={initialView}
          mobile={mobile}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}
