/**
 * The moon (bible §5.3, §2.2): a disc with a rim tint toward `moonRim` and an
 * additive halo in `frost`, drawn by one quad at z −3 (premultiplied output:
 * the halo adds, the disc composites over it). Dark: full disc, halo to 2.2×
 * breathing ±3% over 11 s. Light: a 7% daytime disc with the maria at 3%, no
 * halo. The day/night blend is `frame.moonNight` (900 ms std to full, 500 ms
 * to 7%, §4.3), not the paper's λ 8 damp.
 *
 * The texture is `public/festival/moon-nearside-512.png` (built by
 * `scripts/build-moon-texture.mjs`, which bakes the `pow(1 − r², 0.35)` limb
 * darkening and the levels: highlands ≈ 0.9, maria ≈ 0.5 of `moonBody`);
 * `loadMoonTexture()` returns a 1×1 ivory placeholder that swaps to the PNG
 * when it arrives. The shader applies no second limb term.
 *
 * One quad (borrowed from the fall system when the integrator passes it, so
 * the page stays at 6 geometries), one draw call, render order 6.
 */

import * as THREE from 'three';

import { hexToRgb01, light, palette } from '../palette.ts';
import { pxLengthToWorld, pxToWorld } from './layout.ts';
import type { MoonObjects, MoonObjectsFactory } from './types.ts';

export const MOON_TEXTURE_URL = '/festival/moon-nearside-512.png';
export const MOON_RENDER_ORDER = 6;
export const MOON_Z = light.moon.z;

const rgb = (hex: string) => new THREE.Vector3(...hexToRgb01(hex));

/**
 * A texture that starts as a 1×1 `moonBody` pixel and becomes the PNG once it
 * loads. Pass it to `createMoonObjects`; the disc redraws on its own.
 * `cancelled()` is checked when the PNG arrives: a torn-down layer drops it.
 */
export function loadMoonTexture(
  url = MOON_TEXTURE_URL,
  onLoad?: (texture: THREE.Texture) => void,
  cancelled: () => boolean = () => false,
): THREE.Texture {
  const canvas = document.createElement('canvas');

  canvas.width = 1;
  canvas.height = 1;

  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = palette.moonBody;
    ctx.fillRect(0, 0, 1, 1);
  }

  const texture: THREE.Texture = new THREE.Texture(canvas);

  // Sampled raw: the shader mixes the texel with sRGB-encoded palette
  // constants and writes straight to the sRGB canvas, like the paper shader.
  // An SRGBColorSpace texture would be decoded to linear on sampling and the
  // disc drawn ≈ 35% too dark.
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  new THREE.TextureLoader().load(url, (loaded) => {
    if (cancelled()) {
      loaded.dispose();

      return;
    }
    // WebGL2 storage is immutable at the placeholder's 1×1, so release it
    // before the 512² image is uploaded in its place.
    texture.dispose();
    texture.image = loaded.image;
    texture.needsUpdate = true;
    loaded.dispose();
    onLoad?.(texture);
  });

  return texture;
}

const MOON_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Disc and halo in one quad. The quad spans the halo (2.2× the disc,
 * breathing), so `uHaloScale` maps uv back to disc radii. Output is
 * premultiplied: the halo writes alpha 0 (pure addition over the page) and
 * the disc composites over it.
 */
const MOON_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uAlpha;
  uniform float uNight;
  uniform float uHaloAlpha;
  uniform float uHaloScale;
  uniform vec3 uMoonBody;
  uniform vec3 uMoonRim;
  uniform vec3 uFrost;

  varying vec2 vUv;

  const float LIGHT_DISC = ${light.moon.lightDiscAlpha.toFixed(3)};
  const float LIGHT_MARIA = ${light.moon.lightMariaAlpha.toFixed(3)};
  const float HALO_POW = ${light.moon.halo.falloffPow.toFixed(3)};

  void main() {
    // c in disc radii: |c| = 1 at the limb, uHaloScale at the quad edge.
    vec2 c = (vUv * 2.0 - 1.0) * uHaloScale;
    float r2 = dot(c, c);
    float r = sqrt(r2);
    float fw = fwidth(r);
    float edge = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, r);
    vec4 texel = texture2D(uMap, clamp(c, -1.0, 1.0) * 0.5 + 0.5);

    // Night: the PNG already carries the limb darkening; only the moon-white
    // tint where the disc turns away is applied here.
    float rimT = smoothstep(0.55, 1.0, r) * 0.4;
    vec3 night = mix(texel.rgb, uMoonRim, rimT);

    // Day: a faint ivory disc, the maria at 3% over a 7% disc.
    vec3 day = mix(uMoonBody, texel.rgb, LIGHT_MARIA / LIGHT_DISC);

    vec3 disc = mix(day, night, uNight);
    float discA = mix(LIGHT_DISC, 1.0, uNight) * uAlpha * edge * texel.a;

    // Halo: frost, radial falloff to the quad edge, additive (alpha 0).
    float haloA = pow(max(1.0 - r / uHaloScale, 0.0), HALO_POW) * uHaloAlpha;
    vec3 halo = uFrost * haloA;

    gl_FragColor = vec4(disc * discA + halo * (1.0 - discA), discA);
  }
`;

const _world = { x: 0, y: 0, z: MOON_Z };

/**
 * Disc + halo at z −3. `moonTexture` comes from `loadMoonTexture()`; `quad`
 * is a borrowed unit plane (not disposed here) or omitted for an own one.
 */
export const createMoonObjects: MoonObjectsFactory = (
  renderer,
  moonTexture,
  quad,
) => {
  moonTexture.anisotropy = Math.min(
    4,
    renderer.capabilities.getMaxAnisotropy(),
  );

  const group = new THREE.Group();

  group.name = 'festival-moon';

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: moonTexture },
      uAlpha: { value: 0 },
      uNight: { value: 1 },
      uHaloAlpha: { value: 0 },
      uHaloScale: { value: light.moon.halo.diameterFactor },
      uMoonBody: { value: rgb(palette.moonBody) },
      uMoonRim: { value: rgb(palette.moonRim) },
      uFrost: { value: rgb(palette.frost) },
    },
    vertexShader: MOON_VERTEX,
    fragmentShader: MOON_FRAGMENT,
    transparent: true,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    depthWrite: false,
    depthTest: true,
  });
  const ownsGeometry = quad === undefined;
  const geometry = quad ?? new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.renderOrder = MOON_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.name = 'moon';
  group.add(mesh);
  group.visible = false;

  const objects: MoonObjects = {
    object: group,

    update(moon, frame) {
      group.visible = moon.visible && moon.alpha > 0;

      if (!group.visible) return;

      const night = Math.max(0, Math.min(1, frame.moonNight));
      const diameter = pxLengthToWorld(moon.diameter, MOON_Z, frame.viewport);
      // Halo: 2.2× the disc, breathing ±3% over 11 s; alpha 0.18 dark, 0 light.
      const breath =
        1 +
        light.moon.haloBreathAmplitude *
          Math.sin((frame.ts / light.moon.haloBreathPeriodS) * Math.PI * 2);
      const haloScale = light.moon.halo.diameterFactor * breath;

      pxToWorld(moon.centre, frame.viewport, MOON_Z, _world);
      mesh.position.set(_world.x, _world.y, MOON_Z);
      mesh.scale.set(diameter * haloScale, diameter * haloScale, 1);

      material.uniforms.uAlpha.value = moon.alpha;
      material.uniforms.uNight.value = night;
      material.uniforms.uHaloScale.value = haloScale;
      material.uniforms.uHaloAlpha.value =
        Math.max(0, Math.min(light.moon.halo.peakDark, moon.haloAlpha)) *
        night *
        moon.alpha;
    },

    dispose() {
      group.removeFromParent();
      if (ownsGeometry) geometry.dispose();
      material.dispose();
    },
  };

  return objects;
};
