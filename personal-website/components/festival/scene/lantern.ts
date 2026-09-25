/**
 * The lantern (bible §5.1, §2.2): paper body, hardware, cords, halos, pools.
 *
 * Five draw calls for every lantern on a page:
 *   1. paper     InstancedMesh(LatheGeometry)   custom "light through paper" shader
 *   2. hardware  InstancedMesh(merged)           vertex colours; the tassel part
 *                                                swings on its own angle
 *   3. cords     Mesh (screen-space ribbon)      one buffer, 2 px, catenary sag
 *   4. halos     InstancedMesh(PlaneGeometry)    additive, under the paper
 *   5. pools     InstancedMesh(PlaneGeometry)    normal blending, on the page
 *
 * No scene lights: the paper shader is the light. Local units are body
 * widths (the drum's widest diameter is 1); the oblate 0.86 is baked into the
 * geometry so instance scale is uniform and normals rotate cleanly.
 *
 * Render order inside the group (bible §7.3): halos 0 → pools 1 → paper 2 →
 * hardware 3 → cords 4; fall.ts takes 5 and moon.ts 6–7.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { festival } from '../../../lib/festival.ts';
import { hexToRgb01, light, palette, paperTints } from '../palette.ts';
import { PAPER_ASPECT, pxLengthToWorld, worldPerPx } from './layout.ts';
import {
  SHADOW_STRIP,
  type FrameContext,
  type LanternId,
  type LanternObjects,
  type LanternObjectsFactory,
  type LanternSpec,
  type ShadowStripBuilder,
  type WorldPoint,
} from './types.ts';

// ---------------------------------------------------------------------------
// Construction constants (§5.1). Units: body widths unless stated.
// ---------------------------------------------------------------------------

export const MAX_LANTERNS = 3;
export const LATHE_RADIAL_SEGMENTS = 48;
export const LATHE_PROFILE_SEGMENTS = 20;
/** `[y in body heights, r in body widths]`, top to bottom (§5.1 table). */
export const LANTERN_PROFILE: readonly (readonly [number, number])[] = [
  [0.5, 0.16],
  [0.46, 0.3],
  [0.4, 0.41],
  [0.3, 0.49],
  [0.15, 0.545],
  [0.0, 0.56],
  [-0.15, 0.55],
  [-0.3, 0.5],
  [-0.4, 0.42],
  [-0.46, 0.3],
  [-0.5, 0.16],
];
/**
 * The profile's r is a radius in body widths with a maximum of 0.56, so the
 * drum is normalised by this factor to make its widest diameter exactly one
 * body width (the layout's `bodyRect` is the paper rect, V8).
 */
export const PROFILE_RADIUS_NORM =
  1 / (2 * Math.max(...LANTERN_PROFILE.map(([, r]) => r)));
/** Sixteen rib scallops: `r × (1 − 0.015·(0.5 + 0.5·cos(16θ)))`. */
export const SCALLOP_DEPTH = 0.015;
export const RIB_COUNT = light.paper.ribCount;

/** Paper top/bottom in local (body-width) units. */
const PAPER_TOP = PAPER_ASPECT / 2;

export const HARDWARE = {
  collarRadius: 0.17,
  collarHeight: 0.05,
  /** The collar overlaps the paper opening by this much. */
  collarInset: 0.01,
  /** 1 px chamfer on an 88 px hero, as a fraction of body width. */
  chamfer: 0.012,
  ringRadius: 0.06,
  ringTube: 0.012,
  tasselTop: 0.035,
  tasselBottom: 0.06,
  tasselHeight: 0.32,
  tasselGap: 0.08,
  knotRadius: 0.028,
  strands: 28,
  threadRadius: 0.006,
} as const;

/** Derived y landmarks (local units). */
const COLLAR_TOP_CENTRE =
  PAPER_TOP - HARDWARE.collarInset + HARDWARE.collarHeight / 2;
const COLLAR_TOP_TOP = COLLAR_TOP_CENTRE + HARDWARE.collarHeight / 2;
const COLLAR_BOTTOM_CENTRE = -COLLAR_TOP_CENTRE;
const COLLAR_BOTTOM_BOTTOM = -COLLAR_TOP_TOP;
const RING_CENTRE_Y = COLLAR_TOP_TOP + HARDWARE.ringRadius + HARDWARE.ringTube;
/** Where the cord ends: the ring's top. */
export const CORD_END_Y = RING_CENTRE_Y + HARDWARE.ringRadius;
const KNOT_Y = COLLAR_BOTTOM_BOTTOM - HARDWARE.tasselGap;
/** Bottom-collar point, the slip pin and the tassel pivot. */
export const COLLAR_POINT_Y = COLLAR_BOTTOM_BOTTOM;

export const CORD_SEGMENTS = 12;
/** Catenary sag as a fraction of cord length (§2.2). */
export const CORD_SAG = 0.03;
/**
 * Cord width in CSS px (§2.2). WebGL lines are one device pixel wide, so the
 * cord is a ribbon extruded in the vertex shader to this width.
 */
export const CORD_WIDTH_PX = 2;

export const RENDER_ORDER = {
  halo: 0,
  pool: 1,
  paper: 2,
  hardware: 3,
  cord: 4,
} as const;

/** Fibre noise tile, px (§2.2). */
export const FIBRE_SIZE = 256;

/**
 * Minimum rib half-width in CSS px. The bible's rib term alone
 * (`smoothstep(0.035, 0.012, …)`) is ≈ 0.3 px on an 88 px drum, below one
 * pixel, so the shader widens it to this floor with `fwidth` (V1 needs the
 * meridians to read); the palette numbers stay the lower bound.
 */
export const RIB_MIN_HALF_PX = 0.9;

// ---------------------------------------------------------------------------
// Colours (sRGB-encoded 0..1, written straight to the sRGB canvas)
// ---------------------------------------------------------------------------

const rgb = (hex: string) => new THREE.Vector3(...hexToRgb01(hex));
const PAPER_MID = hexToRgb01(palette.paperMid);

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * The lathe profile, bottom to top, in local units: r normalised so the
 * widest diameter is 1, y already × 0.86.
 */
export function lanternProfilePoints(
  segments = LATHE_PROFILE_SEGMENTS,
): THREE.Vector2[] {
  const control = [...LANTERN_PROFILE]
    .reverse()
    .map(
      ([y, r]) => new THREE.Vector2(r * PROFILE_RADIUS_NORM, y * PAPER_ASPECT),
    );
  const curve = new THREE.SplineCurve(control);

  return curve.getPoints(segments);
}

/** Paper body: lathe with 16 scallops baked in (§5.1). */
export function buildPaperGeometry(): THREE.BufferGeometry {
  // Seam at the back so it never faces the camera. Scallop dips and the
  // shader's ribs both sit at θ = 2πk/16 (the shader derives θ per fragment).
  const phiStart = Math.PI + Math.PI / RIB_COUNT;
  const geometry = new THREE.LatheGeometry(
    lanternProfilePoints(),
    LATHE_RADIAL_SEGMENTS,
    phiStart,
    Math.PI * 2,
  );
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const theta = Math.atan2(x, z);
    const scallop =
      1 - SCALLOP_DEPTH * (0.5 + 0.5 * Math.cos(RIB_COUNT * theta));

    position.setX(i, x * scallop);
    position.setZ(i, z * scallop);
  }

  geometry.computeVertexNormals();

  // Average the seam normals (columns 0 and last share positions).
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const rows = LATHE_PROFILE_SEGMENTS + 1;
  const n = new THREE.Vector3();

  for (let j = 0; j < rows; j += 1) {
    const a = j;
    const b = LATHE_RADIAL_SEGMENTS * rows + j;

    n.set(
      normal.getX(a) + normal.getX(b),
      normal.getY(a) + normal.getY(b),
      normal.getZ(a) + normal.getZ(b),
    ).normalize();
    normal.setXYZ(a, n.x, n.y, n.z);
    normal.setXYZ(b, n.x, n.y, n.z);
  }

  return geometry;
}

type VertexPaint = (
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
) => readonly [number, number, number];

/** Adds `color` and `aPart` attributes so the piece can be merged. */
function paintPiece(
  geometry: THREE.BufferGeometry,
  part: 0 | 1,
  paint: VertexPaint,
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  const parts = new Float32Array(position.count).fill(part);

  for (let i = 0; i < position.count; i += 1) {
    const [r, g, b] = paint(
      position.getX(i),
      position.getY(i),
      position.getZ(i),
      normal.getX(i),
      normal.getY(i),
      normal.getZ(i),
    );

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aPart', new THREE.BufferAttribute(parts, 1));
  geometry.deleteAttribute('uv');

  return geometry;
}

const scale3 = (
  c: readonly [number, number, number],
  k: number,
): readonly [number, number, number] => [
  Math.min(1, c[0] * k),
  Math.min(1, c[1] * k),
  Math.min(1, c[2] * k),
];

const mix3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** One lacquer collar with its chestnut chamfer, top-down shade baked. */
function collarPieces(centreY: number, chamferAtTop: boolean) {
  const { collarRadius: r, collarHeight: h, chamfer } = HARDWARE;
  const cap = hexToRgb01(palette.cap);
  const chestnut = hexToRgb01(palette.capChamfer);
  const bottom = centreY - h / 2;
  const shade: VertexPaint = (_x, y) =>
    scale3(cap, 1 + 0.18 * Math.max(0, Math.min(1, (y - bottom) / h)));
  const body = new THREE.CylinderGeometry(r, r, h - chamfer, 24, 1, false);
  const bevel = chamferAtTop
    ? new THREE.CylinderGeometry(r - chamfer, r, chamfer, 24, 1, false)
    : new THREE.CylinderGeometry(r, r - chamfer, chamfer, 24, 1, false);

  body.translate(0, centreY + (chamferAtTop ? -chamfer / 2 : chamfer / 2), 0);
  bevel.translate(
    0,
    centreY + (chamferAtTop ? (h - chamfer) / 2 : -(h - chamfer) / 2),
    0,
  );

  return [
    paintPiece(body, 0, shade),
    paintPiece(bevel, 0, () => chestnut),
  ] as const;
}

/** Collars, ring (part 0), thread, knot and 28-strand tassel cone (part 1). */
export function buildHardwareGeometry(): THREE.BufferGeometry {
  const brass = hexToRgb01(palette.brass);
  const knot = hexToRgb01(palette.knot);
  const thread = hexToRgb01(palette.cord.dark);
  const tasselFrom = hexToRgb01(palette.tassel.from);
  const tasselTo = hexToRgb01(palette.tassel.to);
  const lightDir = new THREE.Vector3(-0.4, 0.8, 0.45).normalize();

  const ring = new THREE.TorusGeometry(
    HARDWARE.ringRadius,
    HARDWARE.ringTube,
    8,
    24,
  );

  ring.translate(0, RING_CENTRE_Y, 0);

  const threadGeometry = new THREE.CylinderGeometry(
    HARDWARE.threadRadius,
    HARDWARE.threadRadius,
    HARDWARE.tasselGap,
    6,
    1,
    true,
  );

  threadGeometry.translate(0, KNOT_Y + HARDWARE.tasselGap / 2, 0);

  const knotGeometry = new THREE.SphereGeometry(HARDWARE.knotRadius, 12, 8);

  knotGeometry.translate(0, KNOT_Y, 0);

  const coneTop = KNOT_Y;
  const cone = new THREE.CylinderGeometry(
    HARDWARE.tasselTop,
    HARDWARE.tasselBottom,
    HARDWARE.tasselHeight,
    HARDWARE.strands,
    4,
    true,
  );

  cone.translate(0, coneTop - HARDWARE.tasselHeight / 2, 0);

  const pieces = [
    ...collarPieces(COLLAR_TOP_CENTRE, true),
    ...collarPieces(COLLAR_BOTTOM_CENTRE, false),
    paintPiece(ring, 0, (_x, _y, _z, nx, ny, nz) => {
      const facing = Math.max(
        0,
        nx * lightDir.x + ny * lightDir.y + nz * lightDir.z,
      );

      return scale3(brass, 0.85 + 0.5 * facing);
    }),
    paintPiece(threadGeometry, 1, () => thread),
    paintPiece(knotGeometry, 1, (_x, y) =>
      scale3(knot, 0.9 + 0.2 * Math.max(0, (y - KNOT_Y) / HARDWARE.knotRadius)),
    ),
    paintPiece(cone, 1, (x, y, z) => {
      const t = Math.max(0, Math.min(1, (coneTop - y) / HARDWARE.tasselHeight));
      const strand = Math.round(
        ((Math.atan2(x, z) + Math.PI) / (Math.PI * 2)) * HARDWARE.strands,
      );
      const groove = strand % 2 === 0 ? 1 : 0.86;

      return scale3(mix3(tasselFrom, tasselTo, t), groove);
    }),
  ];
  const merged = mergeGeometries(pieces, false);

  pieces.forEach((piece) => piece.dispose());

  if (!merged) throw new Error('lantern: hardware merge failed');

  return merged;
}

/** 256 px tiling value noise for the paper fibre, multiplied at 6% (§2.2). */
export function buildFibreTexture(size = FIBRE_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('lantern: no 2d context for the fibre texture');

  const image = ctx.createImageData(size, size);
  const octaves = [
    { cells: 16, weight: 0.5 },
    { cells: 32, weight: 0.3 },
    { cells: 96, weight: 0.2 },
  ];
  // Seeded lattice so the fibre is identical across mounts.
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x1b873593) >>> 0;

    return ((seed >>> 8) & 0xffffff) / 0x1000000;
  };
  const lattices = octaves.map(({ cells }) =>
    Float32Array.from({ length: cells * cells }, rand),
  );
  const smooth = (t: number) => t * t * (3 - 2 * t);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0;

      octaves.forEach(({ cells, weight }, o) => {
        const lattice = lattices[o];
        // Fibre streaks: stretch the lattice horizontally.
        const fx = ((x / size) * cells * 1.6) % cells;
        const fy = (y / size) * cells;
        const x0 = Math.floor(fx) % cells;
        const y0 = Math.floor(fy) % cells;
        const x1 = (x0 + 1) % cells;
        const y1 = (y0 + 1) % cells;
        const tx = smooth(fx - Math.floor(fx));
        const ty = smooth(fy - Math.floor(fy));
        const top =
          lattice[y0 * cells + x0] * (1 - tx) + lattice[y0 * cells + x1] * tx;
        const bottom =
          lattice[y1 * cells + x0] * (1 - tx) + lattice[y1 * cells + x1] * tx;

        value += (top * (1 - ty) + bottom * ty) * weight;
      });

      const byte = Math.round(Math.max(0, Math.min(1, value)) * 255);
      const i = (y * size + x) * 4;

      image.data[i] = byte;
      image.data[i + 1] = byte;
      image.data[i + 2] = byte;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

// ---------------------------------------------------------------------------
// 走马灯 strip (§5.1)
// ---------------------------------------------------------------------------

/** Left pad before the first title, px; the rest of 4096 is the pause. */
export const SHADOW_STRIP_LEAD_PX = 96;

/**
 * Builds the 4096×256 shadow strip: the titles in `fontFamily` 600 caps at
 * 96 px, tracking 0.08 em, black on transparent, blurred 2 px, copied into a
 * RedFormat DataTexture from the canvas alpha. Call after
 * `document.fonts.ready`; `texture.userData` records the font string (T5),
 * the painted text width and whether the text had to be scaled to fit.
 */
export const buildShadowStrip: ShadowStripBuilder = (titles, fontFamily) => {
  const {
    width,
    height,
    fontPx,
    fontWeight,
    trackingEm,
    blurPx,
    baselineY,
    separator,
  } = SHADOW_STRIP;
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) throw new Error('lantern: no 2d context for the shadow strip');

  const text = titles.map((t) => t.toUpperCase()).join(separator);
  const setFont = (px: number) => {
    ctx.font = `${fontWeight} ${px}px ${fontFamily}`;
  };
  const measure = (px: number) => {
    setFont(px);
    let x = 0;

    for (const ch of text) x += ctx.measureText(ch).width + trackingEm * px;

    return x;
  };
  // Fit inside the strip with a pause at least a title long (≈ 600 px).
  const available = width - SHADOW_STRIP_LEAD_PX - 600;
  let px: number = fontPx;
  let textWidth = measure(px);

  if (textWidth > available) {
    px = Math.floor((fontPx * available) / textWidth);
    textWidth = measure(px);
  }

  setFont(px);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.filter = `blur(${blurPx}px)`;

  let x = SHADOW_STRIP_LEAD_PX;

  for (const ch of text) {
    ctx.fillText(ch, x, baselineY);
    x += ctx.measureText(ch).width + trackingEm * px;
  }

  ctx.filter = 'none';

  const font = ctx.font;
  const image = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);

  // Canvas rows run top-down; texture v = 0 is the paper bottom.
  for (let y = 0; y < height; y += 1) {
    const src = y * width;
    const dst = (height - 1 - y) * width;

    for (let col = 0; col < width; col += 1) {
      data[dst + col] = image[(src + col) * 4 + 3];
    }
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  texture.userData = { font, fontPx: px, textWidth, titles: [...titles] };

  return texture;
};

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const PAPER_VERTEX = /* glsl */ `
  attribute vec3 aTint;
  attribute float aCandle;
  attribute float aLit;
  attribute float aShadow;
  attribute float aScroll;
  attribute float aAlpha;

  varying vec3 vTint;
  varying float vCandle;
  varying float vLit;
  varying float vShadow;
  varying float vScroll;
  varying float vAlpha;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vLocal;
  varying vec2 vUv;

  void main() {
    vTint = aTint;
    vCandle = aCandle;
    vLit = aLit;
    vShadow = aShadow;
    vScroll = aScroll;
    vAlpha = aAlpha;
    vLocal = position;
    vUv = uv;

    // Uniform instance scale: rotate normals with the instance, then the model.
    vec3 n = normalize(mat3(instanceMatrix) * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * n);
    vViewNormal = normalize(normalMatrix * n);

    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const PAPER_FRAGMENT = /* glsl */ `
  uniform sampler2D uFibre;
  uniform sampler2D uShadow;
  uniform float uHasShadow;
  uniform float uNight;
  uniform float uRibHalfPx;
  uniform vec3 uPaperMid;
  uniform vec3 uPaperCore;
  uniform vec3 uPaperRimFrom;
  uniform vec3 uPaperRimTo;
  uniform vec3 uPaperUnlit;

  varying vec3 vTint;
  varying float vCandle;
  varying float vLit;
  varying float vShadow;
  varying float vScroll;
  varying float vAlpha;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vLocal;
  varying vec2 vUv;

  const float PAPER_ASPECT = ${PAPER_ASPECT.toFixed(4)};
  const float RIBS = ${RIB_COUNT.toFixed(1)};
  const float TAU = 6.2832;

  void main() {
    float nz = max(vViewNormal.z, 0.0);
    float through = pow(nz, ${light.paper.throughPow.toFixed(3)});
    // y in body heights (−0.5 .. 0.5); the candle sits at +0.05.
    float y = vLocal.y / PAPER_ASPECT;
    float candle = 1.0 - smoothstep(0.0, ${light.paper.candleBand.toFixed(3)}, abs(y - ${light.paper.candleY.toFixed(3)}));

    vec3 rim = mix(uPaperRimFrom, uPaperRimTo, 1.0 - nz);
    vec3 col = mix(rim, uPaperMid * vTint, through);
    col = mix(col, uPaperCore, ${light.paper.coreMix.toFixed(3)} * through * candle * vCandle);

    // Ribs: dark meridians where the light passes; at least uRibHalfPx wide.
    // The angle comes from the fragment's local position (exact), not from
    // the interpolated uv, whose iso-lines kink across the lathe's trapezoids.
    float ang = atan(vLocal.x, vLocal.z);
    float u = ang / TAU + 0.5 / RIBS;
    float d = abs(fract(u * RIBS) - 0.5) * 2.0;
    // Pixel size of d from the continuous angle (fwidth(d) collapses on the
    // crease at the rib centre and would dash the line): |dd/dang| = RIBS/π.
    float px = fwidth(ang) * (RIBS / 3.14159) * uRibHalfPx;
    float outer = max(${light.paper.ribOuter.toFixed(3)}, px);
    float inner = max(${light.paper.ribInner.toFixed(3)}, px * 0.45);
    float rib = smoothstep(outer, inner, d);
    col *= 1.0 - ${light.paper.ribDarken.toFixed(3)} * vLit * rib;

    // Fibre: 256 px tiling value noise, 6%.
    float fibre = texture2D(uFibre, vec2(vUv.x * 3.0, vUv.y * 1.2)).r;
    float grain = 1.0 + ${light.paper.fibreStrength.toFixed(3)} * (fibre * 2.0 - 1.0);
    col *= grain;

    // 走马灯: the strip read through the paper, one circumference = 22% of it.
    float shadow = texture2D(uShadow, vec2(fract(vScroll + ang / TAU * ${light.paper.shadowCircumferenceFraction.toFixed(3)}), y + 0.5)).r;
    col *= 1.0 - ${light.paper.shadowDarken.toFixed(3)} * shadow * through * vLit * vShadow * uHasShadow;

    // Unlit albedo: sky light from above shades only the underside (0.55 at
    // the belly, the albedo itself at the front so V4 can sample it); dimmer
    // when it is night and the candle is out.
    float lambert = 1.0 - 0.45 * max(-vWorldNormal.y, 0.0);
    vec3 unlit = uPaperUnlit * lambert * (1.0 - ${light.paper.unlitRibDarken.toFixed(3)} * rib) * grain;
    unlit *= mix(1.0, 0.5, uNight);

    col = mix(unlit, col, vLit);
    gl_FragColor = vec4(col, vAlpha);
  }
`;

const HARDWARE_VERTEX = /* glsl */ `
  attribute float aPart;
  attribute float aTassel;
  attribute float aAlpha;

  uniform vec3 uTasselPivot;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    if (aPart > 0.5) {
      float c = cos(aTassel);
      float s = sin(aTassel);
      vec3 q = p - uTasselPivot;
      p = vec3(c * q.x - s * q.y, s * q.x + c * q.y, q.z) + uTasselPivot;
    }
    vColor = color;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

const HARDWARE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

const CORD_VERTEX = /* glsl */ `
  attribute vec3 aOther;
  attribute float aSide;
  attribute float aAlpha;

  uniform vec2 uViewport;
  uniform float uWidthPx;

  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 clipA = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 clipB = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
    vec2 screenA = clipA.xy / clipA.w * uViewport;
    vec2 screenB = clipB.xy / clipB.w * uViewport;
    vec2 dir = normalize(screenB - screenA + vec2(1e-6, 0.0));
    vec2 normal = vec2(-dir.y, dir.x);
    vec2 offset = normal * aSide * uWidthPx * 0.5;
    clipA.xy += offset / uViewport * clipA.w;
    gl_Position = clipA;
  }
`;

const CORD_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

/** Shared by halos and pools (one program, both premultiplied): a radial quad. */
const QUAD_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const QUAD_FRAGMENT = /* glsl */ `
  uniform float uPow;
  uniform float uPremultiply;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float a = pow(max(1.0 - r, 0.0), uPow) * vAlpha;
    gl_FragColor = vec4(vColor * mix(1.0, a, uPremultiply), a);
  }
`;

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

function instancedFloat(count: number, size: number) {
  return new THREE.InstancedBufferAttribute(
    new Float32Array(count * size),
    size,
  );
}

function radialQuad(
  pow: number,
  premultiply: boolean,
  blending: THREE.Blending,
  depthTest: boolean,
  renderOrder: number,
): THREE.InstancedMesh {
  const geometry = new THREE.PlaneGeometry(1, 1);

  geometry.setAttribute('aColor', instancedFloat(MAX_LANTERNS, 3));
  geometry.setAttribute('aAlpha', instancedFloat(MAX_LANTERNS, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPow: { value: pow },
      uPremultiply: { value: premultiply ? 1 : 0 },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: QUAD_FRAGMENT,
    transparent: true,
    blending,
    premultipliedAlpha: premultiply,
    depthTest,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_LANTERNS);

  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;

  return mesh;
}

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _axisZ = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _sag = new THREE.Vector3();
const _point = new THREE.Vector3();

/** Builds the five lantern draw calls. `renderer` supplies the pixel ratio. */
export const createLanternObjects: LanternObjectsFactory = (renderer) => {
  const group = new THREE.Group();

  group.name = 'festival-lanterns';

  // Paper -------------------------------------------------------------------
  const paperGeometry = buildPaperGeometry();

  paperGeometry.setAttribute('aTint', instancedFloat(MAX_LANTERNS, 3));
  paperGeometry.setAttribute('aCandle', instancedFloat(MAX_LANTERNS, 1));
  paperGeometry.setAttribute('aLit', instancedFloat(MAX_LANTERNS, 1));
  paperGeometry.setAttribute('aShadow', instancedFloat(MAX_LANTERNS, 1));
  paperGeometry.setAttribute('aScroll', instancedFloat(MAX_LANTERNS, 1));
  paperGeometry.setAttribute('aAlpha', instancedFloat(MAX_LANTERNS, 1));

  const fibre = buildFibreTexture();
  const emptyShadow = new THREE.DataTexture(
    new Uint8Array([0]),
    1,
    1,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );

  emptyShadow.needsUpdate = true;

  const paperMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uFibre: { value: fibre },
      uShadow: { value: emptyShadow },
      uHasShadow: { value: 0 },
      uNight: { value: 1 },
      uRibHalfPx: { value: RIB_MIN_HALF_PX },
      uPaperMid: { value: rgb(palette.paperMid) },
      uPaperCore: { value: rgb(palette.paperCore) },
      uPaperRimFrom: { value: rgb(palette.paperRim.from) },
      uPaperRimTo: { value: rgb(palette.paperRim.to) },
      uPaperUnlit: { value: rgb(palette.paperUnlit) },
    },
    vertexShader: PAPER_VERTEX,
    fragmentShader: PAPER_FRAGMENT,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  const paper = new THREE.InstancedMesh(
    paperGeometry,
    paperMaterial,
    MAX_LANTERNS,
  );

  paper.count = 0;
  paper.frustumCulled = false;
  paper.renderOrder = RENDER_ORDER.paper;
  paper.name = 'paper';

  // Hardware ----------------------------------------------------------------
  const hardwareGeometry = buildHardwareGeometry();

  hardwareGeometry.setAttribute('aTassel', instancedFloat(MAX_LANTERNS, 1));
  hardwareGeometry.setAttribute('aAlpha', instancedFloat(MAX_LANTERNS, 1));

  const hardwareMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTasselPivot: { value: new THREE.Vector3(0, COLLAR_POINT_Y, 0) },
    },
    vertexShader: HARDWARE_VERTEX,
    fragmentShader: HARDWARE_FRAGMENT,
    vertexColors: true,
    transparent: true,
    depthWrite: true,
  });
  const hardware = new THREE.InstancedMesh(
    hardwareGeometry,
    hardwareMaterial,
    MAX_LANTERNS,
  );

  hardware.count = 0;
  hardware.frustumCulled = false;
  hardware.renderOrder = RENDER_ORDER.hardware;
  hardware.name = 'hardware';

  // Cords -------------------------------------------------------------------
  // Each cord point becomes two ribbon vertices (sides −1/+1); a segment is a
  // quad between consecutive points. `aOther` carries the neighbouring point
  // so the vertex shader can find the screen-space direction.
  const cordPoints = CORD_SEGMENTS + 1;
  const cordVertices = MAX_LANTERNS * cordPoints * 2;
  const cordGeometry = new THREE.BufferGeometry();
  const cordPositions = new THREE.BufferAttribute(
    new Float32Array(cordVertices * 3),
    3,
  );
  const cordOthers = new THREE.BufferAttribute(
    new Float32Array(cordVertices * 3),
    3,
  );
  const cordSides = new THREE.BufferAttribute(
    new Float32Array(cordVertices),
    1,
  );
  const cordAlphas = new THREE.BufferAttribute(
    new Float32Array(cordVertices),
    1,
  );
  const cordIndex: number[] = [];

  for (let i = 0; i < MAX_LANTERNS; i += 1) {
    for (let p = 0; p < cordPoints; p += 1) {
      const v = (i * cordPoints + p) * 2;

      cordSides.setX(v, -1);
      cordSides.setX(v + 1, 1);

      if (p < CORD_SEGMENTS) {
        cordIndex.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
  }

  cordPositions.setUsage(THREE.DynamicDrawUsage);
  cordOthers.setUsage(THREE.DynamicDrawUsage);
  cordAlphas.setUsage(THREE.DynamicDrawUsage);
  cordGeometry.setAttribute('position', cordPositions);
  cordGeometry.setAttribute('aOther', cordOthers);
  cordGeometry.setAttribute('aSide', cordSides);
  cordGeometry.setAttribute('aAlpha', cordAlphas);
  cordGeometry.setIndex(cordIndex);
  cordGeometry.setDrawRange(0, 0);

  const cordMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: rgb(palette.cord.dark) },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uWidthPx: { value: CORD_WIDTH_PX },
    },
    vertexShader: CORD_VERTEX,
    fragmentShader: CORD_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cords = new THREE.Mesh(cordGeometry, cordMaterial);

  cords.frustumCulled = false;
  cords.renderOrder = RENDER_ORDER.cord;
  cords.name = 'cords';

  // Halos and pools ---------------------------------------------------------
  const halos = radialQuad(
    light.halo.falloffPow,
    true,
    THREE.AdditiveBlending,
    false,
    RENDER_ORDER.halo,
  );
  const pools = radialQuad(
    light.pool.falloffPow,
    true,
    THREE.NormalBlending,
    true,
    RENDER_ORDER.pool,
  );

  halos.name = 'halos';
  pools.name = 'pools';

  group.add(halos, pools, paper, hardware, cords);

  // State -------------------------------------------------------------------
  let specs: readonly LanternSpec[] = [];
  const bodyMatrices = Array.from(
    { length: MAX_LANTERNS },
    () => new THREE.Matrix4(),
  );
  const cordDark = hexToRgb01(palette.cord.dark);
  const cordLight = hexToRgb01(palette.cord.light);
  let tintCache = '';
  const haloTint = new THREE.Vector3();
  const poolTint = new THREE.Vector3();

  const attr = (geometry: THREE.BufferGeometry, name: string) =>
    geometry.getAttribute(name) as THREE.InstancedBufferAttribute;

  function setCount(count: number) {
    paper.count = count;
    hardware.count = count;
    halos.count = count;
    pools.count = count;
    cordGeometry.setDrawRange(0, count * CORD_SEGMENTS * 6);
  }

  function refreshTints(frame: FrameContext) {
    const key = `${frame.tints.halo}|${frame.tints.pool}`;

    if (key === tintCache) return;

    tintCache = key;
    haloTint.set(...hexToRgb01(frame.tints.halo));
    poolTint.set(...hexToRgb01(frame.tints.pool));
  }

  function writeCord(
    i: number,
    from: THREE.Vector3,
    to: THREE.Vector3,
    alpha: number,
  ) {
    _dir.subVectors(to, from);

    const length = _dir.length();

    if (length > 1e-6) _dir.divideScalar(length);

    // Catenary: the gravity component across the cord bows it downward.
    _sag
      .set(0, -1, 0)
      .addScaledVector(_dir, _dir.y)
      .multiplyScalar(CORD_SAG * length);

    const base = i * cordPoints * 2;

    for (let p = 0; p <= CORD_SEGMENTS; p += 1) {
      const t = p / CORD_SEGMENTS;

      _point.lerpVectors(from, to, t).addScaledVector(_sag, 4 * t * (1 - t));

      const v = base + p * 2;

      cordPositions.setXYZ(v, _point.x, _point.y, _point.z);
      cordPositions.setXYZ(v + 1, _point.x, _point.y, _point.z);
      cordAlphas.setX(v, alpha);
      cordAlphas.setX(v + 1, alpha);
    }

    // Neighbour for the direction: the next point, or the previous at the end.
    for (let p = 0; p <= CORD_SEGMENTS; p += 1) {
      const v = base + p * 2;
      const n = base + (p < CORD_SEGMENTS ? p + 1 : p - 1) * 2;
      const flip = p < CORD_SEGMENTS ? 1 : -1;
      const ox = cordPositions.getX(n);
      const oy = cordPositions.getY(n);
      const oz = cordPositions.getZ(n);
      // Keep the direction consistent at the last point by mirroring.
      const px = cordPositions.getX(v);
      const py = cordPositions.getY(v);
      const pz = cordPositions.getZ(v);
      const tx = flip > 0 ? ox : px + (px - ox);
      const ty = flip > 0 ? oy : py + (py - oy);
      const tz = flip > 0 ? oz : pz + (pz - oz);

      cordOthers.setXYZ(v, tx, ty, tz);
      cordOthers.setXYZ(v + 1, tx, ty, tz);
    }
  }

  const objects: LanternObjects = {
    object: group,

    build(nextSpecs, frame) {
      specs = nextSpecs.slice(0, MAX_LANTERNS);

      const tint = attr(paperGeometry, 'aTint');
      const shadow = attr(paperGeometry, 'aShadow');
      const revolving = frame.home ? festival.revolvingOnHome : true;

      specs.forEach((spec, i) => {
        const [r, g, b] = hexToRgb01(paperTints[spec.tint]);

        // `paperMid * aTint` in the shader lands exactly on the tint hex.
        tint.setXYZ(i, r / PAPER_MID[0], g / PAPER_MID[1], b / PAPER_MID[2]);
        shadow.setX(i, spec.hero && !frame.mobile && revolving ? 1 : 0);
      });
      tint.needsUpdate = true;
      shadow.needsUpdate = true;
      setCount(specs.length);
      objects.update([], specs, frame);
    },

    update(states, currentSpecs, frame) {
      if (currentSpecs !== specs) {
        specs = currentSpecs.slice(0, MAX_LANTERNS);
        setCount(specs.length);
      }

      refreshTints(frame);

      const night = Math.max(0, Math.min(1, frame.night));

      paperMaterial.uniforms.uNight.value = night;
      (cordMaterial.uniforms.uViewport.value as THREE.Vector2).set(
        frame.viewport.w,
        frame.viewport.h,
      );
      paperMaterial.uniforms.uRibHalfPx.value =
        RIB_MIN_HALF_PX * renderer.getPixelRatio();
      (cordMaterial.uniforms.uColor.value as THREE.Vector3).set(
        cordDark[0] + (cordLight[0] - cordDark[0]) * (1 - night),
        cordDark[1] + (cordLight[1] - cordDark[1]) * (1 - night),
        cordDark[2] + (cordLight[2] - cordDark[2]) * (1 - night),
      );

      const candleAttr = attr(paperGeometry, 'aCandle');
      const litAttr = attr(paperGeometry, 'aLit');
      const scrollAttr = attr(paperGeometry, 'aScroll');
      const paperAlpha = attr(paperGeometry, 'aAlpha');
      const tasselAttr = attr(hardwareGeometry, 'aTassel');
      const hardwareAlpha = attr(hardwareGeometry, 'aAlpha');
      const haloColor = attr(halos.geometry, 'aColor');
      const haloAlpha = attr(halos.geometry, 'aAlpha');
      const poolColor = attr(pools.geometry, 'aColor');
      const poolAlpha = attr(pools.geometry, 'aAlpha');
      const haloPeak = frame.layout.halo
        ? light.halo.peakLight +
          (light.halo.peakDark - light.halo.peakLight) * night
        : 0;
      const poolPeak =
        light.pool.peakLight +
        (frame.layout.poolPeak - light.pool.peakLight) * night;

      specs.forEach((spec, i) => {
        const state = states.find((s) => s.id === spec.id);
        const k = worldPerPx(spec.z, frame.viewport.h);
        const width = pxLengthToWorld(spec.body, spec.z, frame.viewport);
        const height = width * PAPER_ASPECT;
        const theta = state?.theta ?? 0;
        const hang =
          (state?.cordLength ?? spec.cordLengthPx / 100) +
          ((state?.bob ?? 0) - (state?.rise ?? 0)) * k;
        const pivotX = state?.pivot.x ?? 0;
        const pivotY = state?.pivot.y ?? 0;
        const z = state?.pivot.z ?? spec.z;
        const lit = state?.lit ?? 1;
        const candle = state?.candle ?? 1;
        const alpha = state?.alpha ?? 1;
        const drop = hang + PAPER_TOP * width;

        _position.set(
          pivotX + Math.sin(theta) * drop,
          pivotY - Math.cos(theta) * drop,
          z,
        );
        _quaternion.setFromAxisAngle(_axisZ, theta);
        _scale.setScalar(width);
        _matrix.compose(_position, _quaternion, _scale);
        bodyMatrices[i].copy(_matrix);
        paper.setMatrixAt(i, _matrix);
        hardware.setMatrixAt(i, _matrix);

        candleAttr.setX(i, candle);
        litAttr.setX(i, lit);
        scrollAttr.setX(i, state?.shadowScroll ?? 0);
        paperAlpha.setX(i, alpha);
        tasselAttr.setX(i, state?.tasselTheta ?? 0);
        hardwareAlpha.setX(i, alpha);

        // Cord: pivot → ring top.
        _a.set(pivotX, pivotY, z);
        _b.set(0, CORD_END_Y, 0).applyMatrix4(_matrix);
        writeCord(i, _a, _b, alpha);

        // Halo: centred on the body, 2.8× width, under the paper.
        _quaternion.identity();
        _scale.set(
          width * light.halo.widthFactor,
          width * light.halo.widthFactor,
          1,
        );
        _matrix.compose(_position, _quaternion, _scale);
        halos.setMatrixAt(i, _matrix);
        haloColor.setXYZ(i, haloTint.x, haloTint.y, haloTint.z);
        haloAlpha.setX(i, haloPeak * lit * candle * alpha);

        // Pool: on the page under the lantern, 3.2× wide, 1.35× taller.
        _position.y -= light.pool.centreDropBodyHeights * height;
        _position.z = spec.z + light.pool.zOffset;
        _scale.set(
          width * light.pool.widthFactor,
          width * light.pool.widthFactor * light.pool.aspect,
          1,
        );
        _matrix.compose(_position, _quaternion, _scale);
        pools.setMatrixAt(i, _matrix);
        poolColor.setXYZ(i, poolTint.x, poolTint.y, poolTint.z);
        poolAlpha.setX(i, poolPeak * lit * candle * alpha);
      });

      paper.instanceMatrix.needsUpdate = true;
      hardware.instanceMatrix.needsUpdate = true;
      halos.instanceMatrix.needsUpdate = true;
      pools.instanceMatrix.needsUpdate = true;
      candleAttr.needsUpdate = true;
      litAttr.needsUpdate = true;
      scrollAttr.needsUpdate = true;
      paperAlpha.needsUpdate = true;
      tasselAttr.needsUpdate = true;
      hardwareAlpha.needsUpdate = true;
      haloColor.needsUpdate = true;
      haloAlpha.needsUpdate = true;
      poolColor.needsUpdate = true;
      poolAlpha.needsUpdate = true;
      cordPositions.needsUpdate = true;
      cordOthers.needsUpdate = true;
      cordAlphas.needsUpdate = true;
    },

    setShadowStrip(texture) {
      paperMaterial.uniforms.uShadow.value = texture ?? emptyShadow;
      paperMaterial.uniforms.uHasShadow.value = texture ? 1 : 0;
    },

    collarPoint(id: LanternId, out: WorldPoint) {
      const i = specs.findIndex((spec) => spec.id === id);

      if (i < 0) {
        out.x = 0;
        out.y = 0;
        out.z = 0;

        return out;
      }

      _point.set(0, COLLAR_POINT_Y, 0).applyMatrix4(bodyMatrices[i]);
      out.x = _point.x;
      out.y = _point.y;
      out.z = _point.z;

      return out;
    },

    dispose() {
      group.removeFromParent();
      paperGeometry.dispose();
      hardwareGeometry.dispose();
      cordGeometry.dispose();
      halos.geometry.dispose();
      pools.geometry.dispose();
      paperMaterial.dispose();
      hardwareMaterial.dispose();
      cordMaterial.dispose();
      (halos.material as THREE.Material).dispose();
      (pools.material as THREE.Material).dispose();
      fibre.dispose();
      emptyShadow.dispose();
      paper.dispose();
      hardware.dispose();
      halos.dispose();
      pools.dispose();
    },
  };

  return objects;
};
