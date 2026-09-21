#!/usr/bin/env node
/*
 * pixdiff.mjs — compares two PNG screenshots with no dependencies.
 *
 * A pixel counts as changed when any channel differs by more than --tol
 * (default 8 of 255). Prints one JSON object with the changed-pixel share;
 * exits 1 when --max-pct is given and the share is above it, or when the
 * images differ in size.
 *
 * USAGE
 *   node scripts/pixdiff.mjs base.png head.png [--tol 8] [--max-pct 0.5]
 *
 * Decodes 8-bit and 16-bit greyscale/RGB PNGs with or without alpha,
 * non-interlaced — which is what Chrome's captureScreenshot writes.
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/* ---- argv ----------------------------------------------------------------- */

function parseArgs(argv) {
  const files = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      files.push(arg);
      continue;
    }

    const [key, inline] = arg.slice(2).split('=');
    const value = inline ?? argv[++i];

    if (value === undefined) {
      throw new Error(`--${key} needs a value`);
    }

    flags[key] = value;
  }

  return { files, flags };
}

function readNumber(raw, name, fallback) {
  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative number, got ${raw}`);
  }

  return value;
}

/* ---- PNG ------------------------------------------------------------------ */

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) {
    return a;
  }

  return pb <= pc ? b : c;
}

/** Decodes a PNG into 8-bit RGBA samples. */
function decodePng(path) {
  const file = readFileSync(path);

  if (!file.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error(`${path}: not a PNG`);
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  for (let offset = 8; offset < file.length; ) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];

      if (data[12] !== 0) {
        throw new Error(`${path}: interlaced PNGs are not supported`);
      }

      if (!(colorType in CHANNELS) || (bitDepth !== 8 && bitDepth !== 16)) {
        throw new Error(
          `${path}: unsupported PNG (colour type ${colorType}, ${bitDepth}-bit)`,
        );
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  const channels = CHANNELS[colorType];
  const bytesPerSample = bitDepth / 8;
  const bpp = channels * bytesPerSample;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    const line = Uint8Array.prototype.slice.call(
      raw,
      start + 1,
      start + 1 + stride,
    );

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = previous[x];
      const c = x >= bpp ? previous[x - bpp] : 0;

      switch (filter) {
        case 1:
          line[x] = (line[x] + a) & 255;
          break;
        case 2:
          line[x] = (line[x] + b) & 255;
          break;
        case 3:
          line[x] = (line[x] + ((a + b) >> 1)) & 255;
          break;
        case 4:
          line[x] = (line[x] + paeth(a, b, c)) & 255;
          break;
        default:
          break;
      }
    }

    for (let x = 0; x < width; x++) {
      const at = x * bpp;
      /* 16-bit samples keep their high byte. */
      const sample = (index) => line[at + index * bytesPerSample];
      const out = (y * width + x) * 4;

      if (channels < 3) {
        pixels[out] = pixels[out + 1] = pixels[out + 2] = sample(0);
        pixels[out + 3] = channels === 2 ? sample(1) : 255;
      } else {
        pixels[out] = sample(0);
        pixels[out + 1] = sample(1);
        pixels[out + 2] = sample(2);
        pixels[out + 3] = channels === 4 ? sample(3) : 255;
      }
    }

    previous = line;
  }

  return { width, height, pixels };
}

/* ---- diff ------------------------------------------------------------------ */

function diff(base, head, tolerance) {
  const total = base.width * base.height;
  let changed = 0;
  let maxDelta = 0;

  for (let i = 0; i < total * 4; i += 4) {
    let delta = 0;

    for (let channel = 0; channel < 4; channel++) {
      delta = Math.max(
        delta,
        Math.abs(base.pixels[i + channel] - head.pixels[i + channel]),
      );
    }

    if (delta > tolerance) {
      changed += 1;
    }

    maxDelta = Math.max(maxDelta, delta);
  }

  return { total, changed, maxDelta, pct: (changed / total) * 100 };
}

/* ---- main ----------------------------------------------------------------- */

function main() {
  const { files, flags } = parseArgs(process.argv.slice(2));

  if (files.length !== 2) {
    throw new Error(
      'usage: node scripts/pixdiff.mjs base.png head.png [--tol 8] [--max-pct 0.5]',
    );
  }

  const tolerance = readNumber(flags.tol, 'tol', 8);
  const maxPct = readNumber(flags['max-pct'], 'max-pct', null);
  const [basePath, headPath] = files;
  const base = decodePng(basePath);
  const head = decodePng(headPath);
  const result = {
    base: basePath,
    head: headPath,
    width: base.width,
    height: base.height,
    tol: tolerance,
    total: null,
    changed: null,
    changedPct: null,
    maxDelta: null,
    pass: false,
    error: null,
  };

  if (base.width !== head.width || base.height !== head.height) {
    result.error = `size mismatch: ${base.width}x${base.height} vs ${head.width}x${head.height}`;
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const { total, changed, maxDelta, pct } = diff(base, head, tolerance);
  result.total = total;
  result.changed = changed;
  result.changedPct = Number(pct.toFixed(4));
  result.maxDelta = maxDelta;
  result.pass = maxPct === null ? true : pct < maxPct;

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
