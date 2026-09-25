/**
 * Falling things (bible §5.2, §2.3): one InstancedMesh, one atlas, one draw
 * call. The sim owns motion and respawn; this module paints the atlas,
 * composes matrices and colours from `FallInstance`s, and exposes the
 * species-colour rules so whoever assigns colours (sim, integrator, tests)
 * uses one source.
 *
 * Atlas encoding (1024×512, four 256-px columns, sRGB):
 *   R = shade multiplier on the instance colour (1 = the species colour)
 *   G = highlight (added as white × 0.3: the leaf's glossy streak)
 *   A = coverage, cut at alphaTest 0.5
 * so `instanceColor` carries the hue and the tile carries the drawing.
 *
 * Render order 5 (after the lantern draw calls, before the moon).
 */

import * as THREE from 'three';

import {
  floretSpeciesMix,
  hexToRgb01,
  light,
  palette,
  type Rgb01,
} from '../palette.ts';
import { pxToWorld, worldPerPx } from './layout.ts';
import {
  DEPTH_BANDS,
  FALL_ATLAS,
  type AtlasCell,
  type FallObjects,
  type FallObjectsFactory,
  type FallSpecies,
} from './types.ts';

export const FALL_RENDER_ORDER = 5;
export const MAX_FALL_INSTANCES = 36;
/** Highlight strength of the atlas G channel (the 30% white streak). */
export const HIGHLIGHT_STRENGTH = 0.3;
/** Far-band tile blur at atlas scale, px. */
export const FAR_BLUR_PX = 18;

/** Art box of each cell in atlas px (y down) and its width/height aspect. */
export interface AtlasCellRect {
  x: number;
  y: number;
  w: number;
  h: number;
  aspect: number;
}

const COLUMN = FALL_ATLAS.width / FALL_ATLAS.tiles;

export const FALL_CELLS: Record<AtlasCell, AtlasCellRect> = {
  0: { x: 0, y: 128, w: 256, h: 256, aspect: 1 },
  1: { x: COLUMN + 53, y: 16, w: 150, h: 480, aspect: 150 / 480 },
  2: { x: COLUMN * 2 + 8, y: 200, w: 240, h: 210, aspect: 240 / 210 },
  3: { x: COLUMN * 3, y: 128, w: 256, h: 256, aspect: 1 },
};

/** UV rect (x, y, w, h) with v up, as the shader samples it (flipY canvas). */
export function cellUvRect(
  cell: AtlasCell,
): readonly [number, number, number, number] {
  const { x, y, w, h } = FALL_CELLS[cell];

  return [
    x / FALL_ATLAS.width,
    1 - (y + h) / FALL_ATLAS.height,
    w / FALL_ATLAS.width,
    h / FALL_ATLAS.height,
  ];
}

// ---------------------------------------------------------------------------
// Colours (§2.3)
// ---------------------------------------------------------------------------

const FROST = hexToRgb01(palette.frost);
const LEAF_TOP = hexToRgb01(palette.leafGreen.top);
const LEAF_UNDER = hexToRgb01(palette.leafGreen.underside);
const GINKGO_FROM = hexToRgb01(palette.ginkgo.from);
const GINKGO_TO = hexToRgb01(palette.ginkgo.to);
const FLORET_MIX = floretSpeciesMix.map((entry) => ({
  color: hexToRgb01(entry.color),
  weight: entry.weight,
}));

/** Per-channel ratio underside / top, applied to back faces of leaves. */
export const LEAF_UNDERSIDE_RATIO: Rgb01 = [
  LEAF_UNDER[0] / LEAF_TOP[0],
  LEAF_UNDER[1] / LEAF_TOP[1],
  LEAF_UNDER[2] / LEAF_TOP[2],
];

function mix(a: Rgb01, b: Rgb01, t: number): Rgb01 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Warm species colour for a fresh instance. `u` and `v` are 0..1 draws from
 * the seeded RNG: `u` picks the floret variety (80/15/5), `v` sets the
 * ginkgo's green share (40–70%).
 */
export function speciesColor(species: FallSpecies, u: number, v = u): Rgb01 {
  if (species === 'leaf') return LEAF_TOP;
  if (species === 'ginkgo') return mix(GINKGO_FROM, GINKGO_TO, 0.4 + 0.3 * v);

  let acc = 0;

  for (const entry of FLORET_MIX) {
    acc += entry.weight;

    if (u < acc) return entry.color;
  }

  return FLORET_MIX[0].color;
}

/**
 * Cools a warm colour toward `frost` by moon proximity (§2.3): florets
 * nearer the moon than any lantern take its light. The bible writes the
 * ratio as `dMoon / (dMoon + dLantern)`, which would cool florets at the
 * lantern; the prose intent ("nearer to it than to any lantern") is kept, so
 * the ratio is `dLantern / (dMoon + dLantern)`. No moon → warm.
 */
export function coolTowardMoon(
  warm: Rgb01,
  dMoon: number | null,
  dNearestLantern: number,
): Rgb01 {
  if (dMoon === null || !Number.isFinite(dMoon)) return warm;

  const total = dMoon + dNearestLantern;
  const ratio = total > 0 ? dNearestLantern / total : 0;
  const [lo, hi] = light.floret.coolSmoothstep;
  const t = Math.max(0, Math.min(1, (ratio - lo) / (hi - lo)));
  const s = t * t * (3 - 2 * t);
  const cool = mix(warm, FROST, light.floret.coolMix);

  return mix(warm, cool, s);
}

// ---------------------------------------------------------------------------
// Atlas painter
// ---------------------------------------------------------------------------

/** Canvas fills for the R/G encoding. */
const SHADE = (r: number) => `rgb(${Math.round(r * 255)}, 0, 0)`;
const HIGHLIGHT = 'rgb(255, 255, 0)';

function floretAt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.fillStyle = SHADE(1);

  // Four lobes, divided almost to the base.
  for (let k = 0; k < 4; k += 1) {
    ctx.save();
    ctx.rotate((k * Math.PI) / 2);
    ctx.beginPath();
    ctx.ellipse(
      0,
      -radius * 0.56,
      radius * 0.31,
      radius * 0.44,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  // The tube: a touch darker, joins the lobes.
  ctx.fillStyle = SHADE(0.78);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Three florets in a fascicle, filling a 256 box centred at (cx, cy). */
function paintFascicle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1,
) {
  const r = 46 * scale;

  floretAt(ctx, cx - 44, cy - 30, r, 0.15);
  floretAt(ctx, cx + 46, cy - 18, r, -0.5);
  floretAt(ctx, cx - 2, cy + 50, r, 0.85);
}

function paintLeaf(ctx: CanvasRenderingContext2D, box: AtlasCellRect) {
  const cx = box.x + box.w / 2;
  const top = box.y;
  const bottom = box.y + box.h;
  const half = box.w / 2;

  // Long-elliptic blade, entire margin, pointed ends.
  ctx.fillStyle = SHADE(1);
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(
    cx + half * 1.35,
    top + box.h * 0.3,
    cx + half * 1.35,
    bottom - box.h * 0.3,
    cx,
    bottom,
  );
  ctx.bezierCurveTo(
    cx - half * 1.35,
    bottom - box.h * 0.3,
    cx - half * 1.35,
    top + box.h * 0.3,
    cx,
    top,
  );
  ctx.closePath();
  ctx.fill();

  // Midrib, faint.
  ctx.strokeStyle = SHADE(0.86);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, top + 20);
  ctx.lineTo(cx, bottom - 20);
  ctx.stroke();

  // Glossy streak along one side (30% white).
  ctx.strokeStyle = HIGHLIGHT;
  ctx.lineCap = 'round';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(cx - half * 0.25, top + box.h * 0.14);
  ctx.quadraticCurveTo(
    cx - half * 0.62,
    top + box.h * 0.5,
    cx - half * 0.28,
    bottom - box.h * 0.16,
  );
  ctx.stroke();
}

function paintGinkgo(ctx: CanvasRenderingContext2D, box: AtlasCellRect) {
  const apexX = box.x + box.w / 2;
  const bladeH = box.h / 1.6; // petiole is 0.6× the blade
  const apexY = box.y + bladeH;
  const radius = bladeH;
  const spread = (150 * Math.PI) / 180;
  const notch = radius * 0.2;

  // Bilobed fan: a sector with a central notch, no midrib.
  ctx.fillStyle = SHADE(1);
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);

  const a0 = -Math.PI / 2 - spread / 2;
  const a1 = -Math.PI / 2 + spread / 2;

  ctx.arc(apexX, apexY, radius, a0, -Math.PI / 2 - 0.06, false);
  ctx.lineTo(apexX, apexY - radius + notch);
  ctx.arc(apexX, apexY, radius, -Math.PI / 2 + 0.06, a1, false);
  ctx.closePath();
  ctx.fill();

  // Dichotomous veins: seven strokes from the petiole, each forking once.
  ctx.strokeStyle = SHADE(0.84);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (let k = 0; k < 7; k += 1) {
    const angle = a0 + spread * 0.08 + (spread * 0.84 * k) / 6;
    const forkAt = radius * 0.55;
    const fx = apexX + Math.cos(angle) * forkAt;
    const fy = apexY + Math.sin(angle) * forkAt;

    ctx.beginPath();
    ctx.moveTo(apexX, apexY + 6);
    ctx.lineTo(fx, fy);
    ctx.stroke();

    for (const side of [-1, 1]) {
      const branch = angle + side * 0.075;

      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(
        apexX + Math.cos(branch) * radius * 0.96,
        apexY + Math.sin(branch) * radius * 0.96,
      );
      ctx.stroke();
    }
  }

  // Petiole.
  ctx.strokeStyle = SHADE(0.9);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(apexX, box.y + box.h - 4);
  ctx.stroke();
}

/** Paints the four-tile atlas and returns the canvas. */
export function paintFallAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = FALL_ATLAS.width;
  canvas.height = FALL_ATLAS.height;

  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('fall: no 2d context for the atlas');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const floret = FALL_CELLS[0];

  paintFascicle(ctx, floret.x + floret.w / 2, floret.y + floret.h / 2);
  paintLeaf(ctx, FALL_CELLS[1]);
  paintGinkgo(ctx, FALL_CELLS[2]);

  // Far-band floret: the same fascicle, fatter and pre-blurred.
  const far = FALL_CELLS[3];

  ctx.save();
  ctx.filter = `blur(${FAR_BLUR_PX}px)`;
  paintFascicle(ctx, far.x + far.w / 2, far.y + far.h / 2, 1.2);
  ctx.restore();

  return canvas;
}

export function buildFallAtlas(maxAnisotropy = 1): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(paintFallAtlas());

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(4, maxAnisotropy);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _world = { x: 0, y: 0, z: 0 };

/** One InstancedMesh, one atlas, one draw call. */
export const createFallObjects: FallObjectsFactory = (renderer) => {
  const atlas = buildFallAtlas(renderer.capabilities.getMaxAnisotropy());
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uvRects = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_FALL_INSTANCES * 4),
    4,
  );
  const backTints = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_FALL_INSTANCES),
    1,
  );
  const alphas = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_FALL_INSTANCES),
    1,
  );

  uvRects.setUsage(THREE.DynamicDrawUsage);
  backTints.setUsage(THREE.DynamicDrawUsage);
  alphas.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aUvRect', uvRects);
  geometry.setAttribute('aBack', backTints);
  geometry.setAttribute('aAlpha', alphas);

  const material = new THREE.MeshBasicMaterial({
    map: atlas,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    // Cut-outs need no back-then-front pass: one draw call.
    forceSinglePass: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uUnderside = {
      value: new THREE.Vector3(...LEAF_UNDERSIDE_RATIO),
    };
    shader.uniforms.uHighlight = { value: HIGHLIGHT_STRENGTH };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aUvRect;
        attribute float aBack;
        attribute float aAlpha;
        varying float vBack;
        varying float vInstanceAlpha;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vMapUv = aUvRect.xy + uv * aUvRect.zw;
        vBack = aBack;
        vInstanceAlpha = aAlpha;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uUnderside;
        uniform float uHighlight;
        varying float vBack;
        varying float vInstanceAlpha;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 atlasTexel = texture2D( map, vMapUv );
        diffuseColor.a *= atlasTexel.a;
        diffuseColor.rgb *= atlasTexel.r;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb += atlasTexel.g * uHighlight;
        if ( !gl_FrontFacing ) diffuseColor.rgb *= mix( vec3( 1.0 ), uUnderside, vBack );`,
      )
      .replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
        diffuseColor.a *= vInstanceAlpha;`,
      );
  };
  // Distinct program key so the patched shader never collides with a stock one.
  material.customProgramCacheKey = () => 'festival-fall-atlas';

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_FALL_INSTANCES);

  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = FALL_RENDER_ORDER;
  mesh.name = 'festival-fall';
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_FALL_INSTANCES * 3).fill(1),
    3,
  );
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const group = new THREE.Group();

  group.name = 'festival-fall-group';
  group.add(mesh);

  /** Draw slot per instance index, far band first so blending stacks. */
  let slots: number[] = [];

  const objects: FallObjects = {
    object: group,
    atlas,

    build(count) {
      mesh.count = Math.min(count, MAX_FALL_INSTANCES);
      slots = [];
    },

    update(instances, frame) {
      const count = Math.min(instances.length, mesh.count);

      if (slots.length !== count) {
        slots = instances
          .slice(0, count)
          .map((instance, i) => ({ i, band: instance.band }))
          .sort((a, b) => b.band - a.band)
          .map((entry, slot) => [entry.i, slot])
          .reduce<number[]>((acc, [i, slot]) => {
            acc[i] = slot;

            return acc;
          }, []);
      }

      const emitters = frame.layout.florets.emitters;

      for (let i = 0; i < count; i += 1) {
        const instance = instances[i];
        const slot = slots[i];
        const band = DEPTH_BANDS[instance.band];
        const emitter = emitters[instance.emitter];
        const px = (emitter?.x ?? 0) + instance.x;
        const py = (emitter?.y ?? 0) + instance.y;

        pxToWorld({ x: px, y: py }, frame.viewport, band.z, _world);

        const cell = FALL_CELLS[instance.atlasCell];
        const sizeWorld =
          instance.sizePx * band.scale * worldPerPx(band.z, frame.viewport.h);

        _position.set(_world.x, _world.y, _world.z);
        // Spin about the long axis (y), lean in the plane (z).
        _euler.set(0, instance.spin, instance.tilt, 'ZYX');
        _quaternion.setFromEuler(_euler);

        if (cell.aspect >= 1) {
          _scale.set(sizeWorld, sizeWorld / cell.aspect, 1);
        } else {
          _scale.set(sizeWorld * cell.aspect, sizeWorld, 1);
        }

        _matrix.compose(_position, _quaternion, _scale);
        mesh.setMatrixAt(slot, _matrix);

        const [r, g, b] = instance.color;

        _color.setRGB(r, g, b, THREE.SRGBColorSpace);
        mesh.setColorAt(slot, _color);

        const [ux, uy, uw, uh] = cellUvRect(instance.atlasCell);

        uvRects.setXYZW(slot, ux, uy, uw, uh);
        backTints.setX(slot, instance.species === 'leaf' ? 1 : 0);
        alphas.setX(slot, Math.max(0, Math.min(1, instance.alpha)));
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      uvRects.needsUpdate = true;
      backTints.needsUpdate = true;
      alphas.needsUpdate = true;
    },

    dispose() {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
      atlas.dispose();
      mesh.dispose();
    },
  };

  return objects;
};
