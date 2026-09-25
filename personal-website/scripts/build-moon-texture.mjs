/**
 * Mid-Autumn moon texture: projects NASA's LROC colour map of the Moon onto
 * an orthographic near-side disc and writes `public/festival/moon-nearside-512.png`
 * (512², straight alpha outside the disc, within the 60 KB budget of §7.5).
 * Bible §5.3.
 *
 * Run once by hand; the PNG is committed, the source map is not.
 *
 * Usage:
 *   node scripts/build-moon-texture.mjs [--cache <dir>] [--pw <dir>] [--out <file>]
 *                                       [--preview <file>] [--blur <n>] [--levels <n>]
 *                                       [--bands <n>] [--true-colour 1]
 *
 *   --cache        where the 139 KB source JPEG is downloaded and kept
 *                  (default: <os.tmpdir()>/festival-moon-cache)
 *   --pw           a directory whose node_modules holds `playwright-core`, used
 *                  when it is not resolvable from the project (it is not a
 *                  project dependency; `npm i playwright-core` in a scratch dir)
 *   --out          the PNG to write (default: public/festival/moon-nearside-512.png)
 *   --preview      optional PNG of the disc on the dark page ground at 2×, for
 *                  looking at (never committed)
 *   --blur         albedo box-blur radius in supersampled px (default 2 ≈ 1 px
 *                  at 512²; the JPEG grain is invisible on a 150 px moon and
 *                  is what makes the file large)
 *   --levels       brightness levels of the indexed palette (default 40)
 *   --bands        rim-tint bands of the indexed palette (default 4)
 *   --true-colour  1 writes RGBA instead of the indexed PNG (≈ 4× larger,
 *                  keeps 40% of the map's chroma; for comparison only)
 *
 * Source: NASA Scientific Visualization Studio, "CGI Moon Kit" (SVS 4720),
 *   https://svs.gsfc.nasa.gov/4720 — colour map `lroc_color_poles_1k.jpg`
 *   (1024×512 simple cylindrical, 0° longitude at the centre, from the Lunar
 *   Reconnaissance Orbiter Camera WAC mosaic). NASA imagery is in the public
 *   domain; this header is a courtesy credit.
 *   URL: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg
 *
 * Tooling: the scratchpad's `playwright-core` drives a headless Chromium 2D
 *   canvas for the JPEG decode and the projection; shading and the PNG are
 *   done here with `node:zlib` (Chromium's canvas PNG encoder cannot write an
 *   indexed PNG and its RGBA output is ≈ 275 KB). No project dependency.
 *
 * What it does, per §5.3:
 *   1. orthographic projection of the near side at sub-Earth point (0°, 0°):
 *      for a disc point (x, y) ∈ [−1, 1]², z = √(1 − x² − y²), lat = asin y,
 *      lon = atan2(x, z); the map is sampled bilinearly at (lon, lat), 2×
 *      supersampled, box-blurred, and box-filtered down to 512² so the limb is
 *      antialiased (coverage alpha) and the JPEG grain is averaged out;
 *   2. desaturates 60% toward luma (the indexed encoding then keeps luma only:
 *      the ivory base carries the warmth, the residual 40% chroma of the map
 *      is below one palette step);
 *   3. limb darkening `pow(1 − r², 0.35)` (baked here once; the moon shader
 *      applies no second limb term);
 *   4. normalises brightness so the 99.5th-percentile pixel of the darkened
 *      disc is the ivory `moonBody` (#fffbf0), then lifts the levels
 *      `b' = LIFT + (1 − LIFT)·b` so the highlands sit at ≈ 0.9 and the maria
 *      at ≈ 0.5–0.6 of moonBody: the disc reads as the brightest thing on
 *      the page (§1, §2.1; mean disc Y ≥ 0.45, p90 ≥ 0.75), the brightest
 *      highlands still equal the palette constant (§7.7 V3) and the rabbit
 *      is still findable;
 *   5. tints the rim 12% toward `moonRim` (#d6ecf0), weighted r³ so the
 *      centre is untouched;
 *   6. alpha 255 inside the disc, 0 outside, coverage-averaged at the limb.
 *
 * Encoding: an indexed PNG (colour type 3 + tRNS, 1 byte per pixel) whose
 *   palette is ordered by brightness inside each rim-tint band, so the index
 *   field is as smooth as the moon and the PNG row filters have small
 *   residuals. Palette layout with L levels and T bands: index t·L + k is
 *   brightness k/(L−1) in band t; index T·L is fully transparent; the
 *   remaining 256 − T·L − 1 entries are the limb's partial-alpha pixels,
 *   bucketed by alpha with their mean colour.
 *
 * Assertions: 512², alpha 0 at the corners, opaque area = π/4 of the square,
 * max disc luminance within 0.01 of `moonBody`, file ≤ 60 KB.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_URL =
  'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg';
const SOURCE_FILE = 'lroc_color_poles_1k.jpg';
const SOURCE_MIN_BYTES = 100_000;

export const SIZE = 512;
const SUPERSAMPLE = 2;
/** Palette constants (`components/festival/palette.ts`), repeated so the script has no TS import. */
export const MOON_BODY = '#fffbf0';
export const MOON_RIM = '#d6ecf0';
const PAGE_GROUND = '#12100d';
export const DESATURATE = 0.6;
export const LIMB_POW = 0.35;
export const RIM_TINT = 0.12;
export const WHITE_PERCENTILE = 0.995;
/** Levels lift on the normalised, limb-darkened luma: `LIFT + (1 − LIFT)·b`. */
export const LIFT = 0.28;
export const BLUR_RADIUS = 2;
export const PALETTE_LEVELS = 40;
export const PALETTE_BANDS = 4;
/** §7.5 payload row: moon ≤ 60 KB. */
export const MAX_BYTES = 60 * 1024;

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function numberArg(value, fallback, name) {
  if (value === undefined) return fallback;

  const n = Number(value);

  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);

  return n;
}

const hexToRgb = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

async function download(url, target) {
  if (existsSync(target) && statSync(target).size >= SOURCE_MIN_BYTES) {
    console.log(`source cached: ${target}`);

    return;
  }

  console.log(`downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status} for ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length < SOURCE_MIN_BYTES) {
    throw new Error(`download too small (${bytes.length} bytes)`);
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  console.log(`saved ${bytes.length} bytes → ${target}`);
}

async function loadPlaywright(pwDir) {
  try {
    return await import('playwright-core');
  } catch {
    if (!pwDir) {
      throw new Error(
        'playwright-core not found; pass --pw <dir> where `npm i playwright-core` was run',
      );
    }

    const require = createRequire(join(resolve(pwDir), 'package.json'));
    const mod = await import(
      pathToFileURL(require.resolve('playwright-core')).href
    );

    return mod.chromium ? mod : mod.default;
  }
}

/** Newest cached Playwright Chromium build (same lookup as capture-bench.mjs). */
function chromiumExecutable() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const build = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .at(-1);

  if (!build) {
    throw new Error(
      'No cached Chromium build found; run: npx playwright-core install chromium',
    );
  }

  return join(
    cache,
    build,
    'chrome-mac-arm64',
    'Google Chrome for Testing.app',
    'Contents',
    'MacOS',
    'Google Chrome for Testing',
  );
}

// ---------------------------------------------------------------------------
// In the page: decode, project, blur, downsample. Returns straight RGBA where
// RGB is the desaturated map albedo (0..255) and A is the disc coverage.
// ---------------------------------------------------------------------------

async function projectInPage({
  dataUrl,
  size,
  supersample,
  desaturate,
  blurRadius,
}) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = image.naturalWidth;
  mapCanvas.height = image.naturalHeight;
  const mapCtx = mapCanvas.getContext('2d', { willReadFrequently: true });
  mapCtx.drawImage(image, 0, 0);
  const map = mapCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height);
  const mw = map.width;
  const mh = map.height;
  const md = map.data;

  // Bilinear sample of the equirectangular map; u wraps, v clamps.
  const sample = (u, v, out) => {
    const fx = u * mw - 0.5;
    const fy = Math.min(Math.max(v * mh - 0.5, 0), mh - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const xa = ((x0 % mw) + mw) % mw;
    const xb = (xa + 1) % mw;
    const yb = Math.min(y0 + 1, mh - 1);

    for (let c = 0; c < 3; c += 1) {
      const p00 = md[(y0 * mw + xa) * 4 + c];
      const p10 = md[(y0 * mw + xb) * 4 + c];
      const p01 = md[(yb * mw + xa) * 4 + c];
      const p11 = md[(yb * mw + xb) * 4 + c];
      out[c] =
        (p00 * (1 - tx) + p10 * tx) * (1 - ty) +
        (p01 * (1 - tx) + p11 * tx) * ty;
    }
  };

  const S = size * supersample;
  let albedo = new Float32Array(S * S * 3);
  const inside = new Uint8Array(S * S);
  const px = [0, 0, 0];

  for (let j = 0; j < S; j += 1) {
    const y = 1 - (2 * (j + 0.5)) / S;

    for (let i = 0; i < S; i += 1) {
      const x = (2 * (i + 0.5)) / S - 1;
      const rr = x * x + y * y;

      if (rr > 1) continue;

      const z = Math.sqrt(1 - rr);
      const lat = Math.asin(y);
      const lon = Math.atan2(x, z);
      sample(lon / (2 * Math.PI) + 0.5, 0.5 - lat / Math.PI, px);

      const luma = 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
      const k = (j * S + i) * 3;
      albedo[k] = px[0] + (luma - px[0]) * desaturate;
      albedo[k + 1] = px[1] + (luma - px[1]) * desaturate;
      albedo[k + 2] = px[2] + (luma - px[2]) * desaturate;
      inside[j * S + i] = 1;
    }
  }

  // Two-pass separable box blur inside the disc (≈ a tent filter).
  for (let pass = 0; pass < (blurRadius > 0 ? 2 : 0); pass += 1) {
    for (const axis of [0, 1]) {
      const dst = new Float32Array(S * S * 3);

      for (let j = 0; j < S; j += 1) {
        for (let i = 0; i < S; i += 1) {
          const n = j * S + i;

          if (!inside[n]) continue;

          let count = 0;
          const sum = [0, 0, 0];

          for (let d = -blurRadius; d <= blurRadius; d += 1) {
            const ii = axis === 0 ? i + d : i;
            const jj = axis === 0 ? j : j + d;

            if (ii < 0 || jj < 0 || ii >= S || jj >= S) continue;

            const m = jj * S + ii;

            if (!inside[m]) continue;

            count += 1;
            sum[0] += albedo[m * 3];
            sum[1] += albedo[m * 3 + 1];
            sum[2] += albedo[m * 3 + 2];
          }

          dst[n * 3] = sum[0] / count;
          dst[n * 3 + 1] = sum[1] / count;
          dst[n * 3 + 2] = sum[2] / count;
        }
      }

      albedo = dst;
    }
  }

  // Box-filter to `size`: coverage-weighted albedo, straight alpha.
  const out = new Uint8ClampedArray(size * size * 4);
  const ss = supersample * supersample;

  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const sum = [0, 0, 0];
      let cover = 0;

      for (let dj = 0; dj < supersample; dj += 1) {
        for (let di = 0; di < supersample; di += 1) {
          const n = (j * supersample + dj) * S + i * supersample + di;

          if (!inside[n]) continue;

          cover += 1;
          sum[0] += albedo[n * 3];
          sum[1] += albedo[n * 3 + 1];
          sum[2] += albedo[n * 3 + 2];
        }
      }

      const k = (j * size + i) * 4;

      if (cover > 0) {
        out[k] = sum[0] / cover;
        out[k + 1] = sum[1] / cover;
        out[k + 2] = sum[2] / cover;
        out[k + 3] = (cover / ss) * 255;
      }
    }
  }

  let binary = '';

  for (let i = 0; i < out.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Shading (steps 3–5) on the 512² albedo, in Node
// ---------------------------------------------------------------------------

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function radiusAt(i, j, size) {
  const x = (2 * (i + 0.5)) / size - 1;
  const y = (2 * (j + 0.5)) / size - 1;

  return Math.sqrt(x * x + y * y);
}

/** Brightness × rim-weight → colour, the one shading rule both encoders use. */
function shadeColour(bodyRgb, rimRgb, brightness, rimWeight) {
  return [0, 1, 2].map((c) => {
    const lit = bodyRgb[c] * brightness;
    const rim = rimRgb[c] * brightness;

    return lit + (rim - lit) * RIM_TINT * rimWeight;
  });
}

/**
 * Per-pixel brightness (limb-darkened luma / white, clamped to 1, then lifted
 * by `LIFT`), rim weight r³ and alpha. `white` is the 99.5th percentile of the
 * limb-darkened luma over the opaque disc, after the blur.
 */
function analyse(albedo, size) {
  const count = size * size;
  const brightness = new Float32Array(count);
  const rimWeight = new Float32Array(count);
  const alpha = new Uint8Array(count);
  const shadedLumas = [];

  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const p = j * size + i;
      alpha[p] = albedo[p * 4 + 3];

      if (!alpha[p]) continue;

      const r = Math.min(radiusAt(i, j, size), 1);
      const limb = Math.pow(1 - r * r, LIMB_POW);
      brightness[p] =
        luma(albedo[p * 4], albedo[p * 4 + 1], albedo[p * 4 + 2]) * limb;
      rimWeight[p] = r * r * r;

      if (alpha[p] === 255) shadedLumas.push(brightness[p]);
    }
  }

  // White point on the limb-darkened luma, so the brightest 0.5% of the disc
  // clip to moonBody whatever the map's exposure.
  shadedLumas.sort((a, b) => a - b);
  const white =
    shadedLumas[Math.floor((shadedLumas.length - 1) * WHITE_PERCENTILE)];

  for (let p = 0; p < count; p += 1) {
    if (!alpha[p]) continue;
    brightness[p] = LIFT + (1 - LIFT) * Math.min(brightness[p] / white, 1);
  }

  return { white, brightness, rimWeight, alpha };
}

// ---------------------------------------------------------------------------
// PNG encoding (adaptive per-row filter, zlib level 9)
// ---------------------------------------------------------------------------

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0);

  return Buffer.concat([length, typed, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;

  return pb <= pc ? b : c;
}

/** Filters one row with every PNG filter and keeps the lowest-sum one. */
function filterRow(row, prev, bpp) {
  const n = row.length;
  let best = null;

  for (let type = 0; type < 5; type += 1) {
    const out = Buffer.alloc(n + 1);
    out[0] = type;
    let sum = 0;

    for (let i = 0; i < n; i += 1) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v;

      if (type === 0) v = row[i];
      else if (type === 1) v = row[i] - a;
      else if (type === 2) v = row[i] - b;
      else if (type === 3) v = row[i] - ((a + b) >> 1);
      else v = row[i] - paeth(a, b, c);

      v &= 255;
      out[i + 1] = v;
      sum += v < 128 ? v : 256 - v;
    }

    if (!best || sum < best.sum) best = { sum, out };
  }

  return best.out;
}

function pngFile(width, height, colourType, extraChunks, pixels, bpp) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colourType; // 6 = RGBA, 3 = indexed

  const stride = width * bpp;
  const rows = [];
  let prev = null;

  for (let y = 0; y < height; y += 1) {
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    rows.push(filterRow(row, prev, bpp));
    prev = row;
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...extraChunks,
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** True-colour RGBA PNG. */
export function encodeRgbaPng(rgba, width, height) {
  return pngFile(width, height, 6, [], rgba, 4);
}

/**
 * Shades every pixel in full precision (keeps the 40% residual chroma of the
 * map by scaling each albedo channel) and returns straight RGBA.
 */
function shadeTrueColour(albedo, size, bodyRgb, rimRgb) {
  const { white, brightness, rimWeight, alpha } = analyse(albedo, size);
  const rgba = new Uint8Array(size * size * 4);

  for (let p = 0; p < size * size; p += 1) {
    if (!alpha[p]) continue;

    const l = luma(albedo[p * 4], albedo[p * 4 + 1], albedo[p * 4 + 2]);
    const colour = shadeColour(bodyRgb, rimRgb, brightness[p], rimWeight[p]);

    for (let c = 0; c < 3; c += 1) {
      const chroma = l > 0 ? albedo[p * 4 + c] / l : 1;
      rgba[p * 4 + c] = Math.round(Math.min(255, colour[c] * chroma));
    }
    rgba[p * 4 + 3] = alpha[p];
  }

  return { rgba, white };
}

/**
 * Indexed encoding: palette ordered by brightness within rim-tint bands, one
 * transparent entry, and the limb's partial-alpha pixels bucketed by alpha.
 */
function shadeIndexed(albedo, size, bodyRgb, rimRgb, levels, bands) {
  const { white, brightness, rimWeight, alpha } = analyse(albedo, size);
  const opaqueEntries = levels * bands;
  const transparentIndex = opaqueEntries;
  const edgeBuckets = 256 - opaqueEntries - 1;

  if (edgeBuckets < 4) {
    throw new Error('levels × bands leaves no room for the limb');
  }

  const palette = [];

  for (let t = 0; t < bands; t += 1) {
    const weight = (t + 0.5) / bands;

    for (let k = 0; k < levels; k += 1) {
      const colour = shadeColour(bodyRgb, rimRgb, k / (levels - 1), weight);
      palette.push([...colour.map(Math.round), 255]);
    }
  }
  palette.push([0, 0, 0, 0]);

  const edgeSum = Array.from({ length: edgeBuckets }, () => [0, 0, 0, 0, 0]);
  const indices = new Uint8Array(size * size);

  for (let p = 0; p < size * size; p += 1) {
    if (alpha[p] === 0) {
      indices[p] = transparentIndex;
    } else if (alpha[p] === 255) {
      const k = Math.round(brightness[p] * (levels - 1));
      const t = Math.min(bands - 1, Math.floor(rimWeight[p] * bands));
      indices[p] = t * levels + k;
    } else {
      const m = Math.min(
        edgeBuckets - 1,
        Math.floor((alpha[p] / 255) * edgeBuckets),
      );
      const colour = shadeColour(bodyRgb, rimRgb, brightness[p], rimWeight[p]);
      const sum = edgeSum[m];
      sum[0] += colour[0];
      sum[1] += colour[1];
      sum[2] += colour[2];
      sum[3] += alpha[p];
      sum[4] += 1;
      indices[p] = transparentIndex + 1 + m;
    }
  }

  for (const sum of edgeSum) {
    const n = sum[4] || 1;
    palette.push([
      Math.round(sum[0] / n),
      Math.round(sum[1] / n),
      Math.round(sum[2] / n),
      Math.round(sum[3] / n),
    ]);
  }

  const plte = Buffer.alloc(palette.length * 3);
  const trns = Buffer.alloc(palette.length);

  palette.forEach(([r, g, b, a], i) => {
    plte[i * 3] = r;
    plte[i * 3 + 1] = g;
    plte[i * 3 + 2] = b;
    trns[i] = a;
  });

  const png = pngFile(
    size,
    size,
    3,
    [chunk('PLTE', plte), chunk('tRNS', trns)],
    indices,
    1,
  );

  // Expand for the assertions and the preview: what the browser will decode.
  const rgba = new Uint8Array(size * size * 4);

  for (let p = 0; p < size * size; p += 1) {
    rgba.set(palette[indices[p]], p * 4);
  }

  return { png, rgba, white };
}

// ---------------------------------------------------------------------------
// Checks and preview
// ---------------------------------------------------------------------------

function relativeLuminance(r, g, b) {
  const lin = (c) => {
    const s = c / 255;

    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function assertTexture(rgba, bytes, bodyRgb) {
  const problems = [];
  const corner = (x, y) => rgba[(y * SIZE + x) * 4 + 3];

  if (corner(0, 0) || corner(SIZE - 1, 0) || corner(0, SIZE - 1)) {
    problems.push('corner alpha is not 0');
  }

  const bodyY = relativeLuminance(...bodyRgb);
  let maxY = 0;
  let opaque = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 255) {
      opaque += 1;
      maxY = Math.max(
        maxY,
        relativeLuminance(rgba[i], rgba[i + 1], rgba[i + 2]),
      );
    }
  }

  const discFraction = opaque / (SIZE * SIZE);

  if (Math.abs(discFraction - Math.PI / 4) > 0.01) {
    problems.push(`opaque fraction ${discFraction.toFixed(3)}, expected π/4`);
  }
  if (Math.abs(maxY - bodyY) > 0.01) {
    problems.push(
      `max disc luminance ${maxY.toFixed(3)}, expected ≈ moonBody ${bodyY.toFixed(3)}`,
    );
  }
  if (bytes > MAX_BYTES) {
    problems.push(`${bytes} bytes exceeds the ${MAX_BYTES} byte budget`);
  }

  if (problems.length > 0) {
    throw new Error(`texture assertions failed:\n  ${problems.join('\n  ')}`);
  }

  return { maxY, bodyY };
}

/** The disc on the page ground at 2×, nearest-neighbour, for eyeballing. */
function preview(rgba) {
  const scale = 2;
  const W = SIZE * scale;
  const ground = hexToRgb(PAGE_GROUND);
  const out = new Uint8Array(W * W * 4);

  for (let y = 0; y < W; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const s = ((y >> 1) * SIZE + (x >> 1)) * 4;
      const a = rgba[s + 3] / 255;
      const k = (y * W + x) * 4;

      for (let c = 0; c < 3; c += 1) {
        out[k + c] = Math.round(ground[c] + (rgba[s + c] - ground[c]) * a);
      }
      out[k + 3] = 255;
    }
  }

  return encodeRgbaPng(out, W, W);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cache = resolve(args.cache ?? join(tmpdir(), 'festival-moon-cache'));
  const output = resolve(
    args.out ?? join(PROJECT_ROOT, 'public/festival/moon-nearside-512.png'),
  );
  const blurRadius = numberArg(args.blur, BLUR_RADIUS, 'blur');
  const levels = numberArg(args.levels, PALETTE_LEVELS, 'levels');
  const bands = numberArg(args.bands, PALETTE_BANDS, 'bands');
  const trueColour = args['true-colour'] === '1';

  const source = join(cache, SOURCE_FILE);
  await download(SOURCE_URL, source);

  const { chromium } = await loadPlaywright(args.pw);
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
  });
  let albedoBase64;

  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>moon</title>');
    albedoBase64 = await page.evaluate(projectInPage, {
      dataUrl: `data:image/jpeg;base64,${readFileSync(source).toString('base64')}`,
      size: SIZE,
      supersample: SUPERSAMPLE,
      desaturate: DESATURATE,
      blurRadius,
    });
  } finally {
    await browser.close();
  }

  const albedo = new Uint8Array(Buffer.from(albedoBase64, 'base64'));
  const bodyRgb = hexToRgb(MOON_BODY);
  const rimRgb = hexToRgb(MOON_RIM);
  let png;
  let rgba;
  let white;

  if (trueColour) {
    ({ rgba, white } = shadeTrueColour(albedo, SIZE, bodyRgb, rimRgb));
    png = encodeRgbaPng(rgba, SIZE, SIZE);
  } else {
    ({ png, rgba, white } = shadeIndexed(
      albedo,
      SIZE,
      bodyRgb,
      rimRgb,
      levels,
      bands,
    ));
  }

  const { maxY, bodyY } = assertTexture(rgba, png.length, bodyRgb);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, png);
  console.log(
    `ok: ${SIZE}² ${trueColour ? 'RGBA' : `indexed ${levels}×${bands}`}, ` +
      `white ${white.toFixed(1)}/255, max Y ${maxY.toFixed(3)} (moonBody ${bodyY.toFixed(3)}), ` +
      `${png.length} bytes → ${output}`,
  );

  if (args.preview) {
    const target = resolve(args.preview);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, preview(rgba));
    console.log(`preview → ${target}`);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
