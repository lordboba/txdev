#!/usr/bin/env node
/**
 * Pixel comparison for two same-size PNG screenshots, dependency free.
 *
 *   node scripts/pixdiff.mjs before.png after.png [--threshold=8] [--out=diff.png]
 *
 * Reports the share of pixels whose max channel delta exceeds the threshold
 * (default 8/255), the mean absolute channel delta and the max delta, as
 * JSON on stdout. With --out the differing pixels are written as a red-on-
 * grey heat map so a reviewer can see where the two frames disagree.
 *
 * Handles 8-bit non-interlaced RGB and RGBA PNGs, which is what Chrome's
 * Page.captureScreenshot produces.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const positional = [];
const options = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const [key, ...rest] = arg.slice(2).split('=');
    options[key] = rest.join('=') || 'true';
  } else {
    positional.push(arg);
  }
}

const [beforePath, afterPath] = positional;
if (!beforePath || !afterPath) {
  console.error(
    'usage: pixdiff.mjs before.png after.png [--threshold=8] [--out=diff.png]',
  );
  process.exit(2);
}
const THRESHOLD = Number(options.threshold ?? 8);
const OUT_PATH = options.out ?? null;

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
const crc32 = (buffer) => {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
};

/** Decode to { width, height, channels, data } with data laid out row-major. */
function decodePng(path) {
  const file = readFileSync(path);
  if (!file.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error(`${path}: not a PNG`);
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const channels = { 2: 3, 6: 4, 0: 1, 4: 2 }[colorType];
  if (bitDepth !== 8 || !channels || interlace !== 0) {
    throw new Error(
      `${path}: only 8-bit non-interlaced RGB/RGBA/grey PNGs are supported`,
    );
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[source++];
    const rowStart = y * stride;
    const previousStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[source++];
      const left = x >= channels ? data[rowStart + x - channels] : 0;
      const up = y > 0 ? data[previousStart + x] : 0;
      const upLeft =
        y > 0 && x >= channels ? data[previousStart + x - channels] : 0;
      let predictor = 0;
      switch (filter) {
        case 1:
          predictor = left;
          break;
        case 2:
          predictor = up;
          break;
        case 3:
          predictor = (left + up) >> 1;
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          break;
        }
        default:
          predictor = 0;
      }
      data[rowStart + x] = (value + predictor) & 0xff;
    }
  }
  return { width, height, channels, data };
}

function encodePng({ width, height, data }) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, body) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(body.length, 0);
    header.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), body])), 0);
    return Buffer.concat([header, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const before = decodePng(beforePath);
const after = decodePng(afterPath);
if (before.width !== after.width || before.height !== after.height) {
  console.error(
    `size mismatch: ${before.width}x${before.height} vs ${after.width}x${after.height}`,
  );
  process.exit(2);
}

const { width, height } = before;
const pixels = width * height;
const heat = OUT_PATH ? Buffer.alloc(pixels * 3) : null;
let overThreshold = 0;
let sumAbs = 0;
let maxDelta = 0;
let histogram = new Array(9).fill(0); // buckets of 8: 0-7, 8-15, ... 64+

for (let i = 0; i < pixels; i++) {
  const b = i * before.channels;
  const a = i * after.channels;
  let pixelMax = 0;
  for (let c = 0; c < 3; c++) {
    const delta = Math.abs(before.data[b + c] - after.data[a + c]);
    sumAbs += delta;
    if (delta > pixelMax) pixelMax = delta;
  }
  if (pixelMax > maxDelta) maxDelta = pixelMax;
  if (pixelMax > THRESHOLD) overThreshold += 1;
  histogram[Math.min(8, pixelMax >> 3)] += 1;
  if (heat) {
    const grey = Math.round(
      (before.data[b] * 0.2126 +
        before.data[b + 1] * 0.7152 +
        before.data[b + 2] * 0.0722) *
        0.35,
    );
    if (pixelMax > THRESHOLD) {
      heat[i * 3] = 255;
      heat[i * 3 + 1] = Math.max(0, 96 - pixelMax);
      heat[i * 3 + 2] = Math.max(0, 96 - pixelMax);
    } else {
      heat[i * 3] = grey;
      heat[i * 3 + 1] = grey;
      heat[i * 3 + 2] = grey;
    }
  }
}

if (heat) {
  writeFileSync(OUT_PATH, encodePng({ width, height, data: heat }));
}

console.log(
  JSON.stringify(
    {
      before: beforePath,
      after: afterPath,
      size: [width, height],
      threshold: THRESHOLD,
      pixelsOverThreshold: overThreshold,
      percentOverThreshold: Number(((overThreshold / pixels) * 100).toFixed(4)),
      meanAbsDelta: Number((sumAbs / (pixels * 3)).toFixed(4)),
      maxDelta,
      histogramBy8: histogram,
      heatmap: OUT_PATH,
    },
    null,
    2,
  ),
);
