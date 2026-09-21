/**
 * Pure route geometry for the journey atlas: the spine curve through the
 * chapters, sampled once into a polyline so the token can travel along it and
 * the amber "travelled so far" stroke can be measured in the same units the
 * SVG path is told to use (via `pathLength`). No DOM — testable in node.
 */

export type Point = { x: number; y: number };

export type Spine = {
  /** SVG path data: Catmull-Rom cubics through every point in order. */
  d: string;
  /** Polyline samples along `d`, each with its cumulative length. */
  samples: (Point & { length: number })[];
  /** Cumulative length at each input point, index-aligned with the input. */
  pointLengths: number[];
  total: number;
};

const SAMPLES_PER_SEGMENT = 24;

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number) {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

/**
 * Centripetal Catmull-Rom → cubic Bezier control points for p1 → p2. The
 * centripetal parameterisation (alpha 0.5) is what keeps a route with one
 * coast-to-coast hop next to a handful of city-block steps from looping back
 * on itself: uniform Catmull-Rom overshoots wherever the spacing is uneven.
 * The two ends are extended by reflection so the route leaves and arrives
 * straight instead of curling.
 */
function controls(points: Point[], i: number) {
  const p1 = points[i];
  const p2 = points[i + 1];
  const p0 = points[i - 1] ?? { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
  const p3 = points[i + 2] ?? { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };

  const knot = (a: Point, b: Point) =>
    Math.max(Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)), 1e-3);
  const d01 = knot(p0, p1);
  const d12 = knot(p1, p2);
  const d23 = knot(p2, p3);

  const m1 = {
    x: (p1.x - p0.x) / d01 - (p2.x - p0.x) / (d01 + d12) + (p2.x - p1.x) / d12,
    y: (p1.y - p0.y) / d01 - (p2.y - p0.y) / (d01 + d12) + (p2.y - p1.y) / d12,
  };
  const m2 = {
    x: (p2.x - p1.x) / d12 - (p3.x - p1.x) / (d12 + d23) + (p3.x - p2.x) / d23,
    y: (p2.y - p1.y) / d12 - (p3.y - p1.y) / (d12 + d23) + (p3.y - p2.y) / d23,
  };

  return {
    p1,
    p2,
    c1: { x: p1.x + (m1.x * d12) / 3, y: p1.y + (m1.y * d12) / 3 },
    c2: { x: p2.x - (m2.x * d12) / 3, y: p2.y - (m2.y * d12) / 3 },
  };
}

export function buildSpine(points: Point[]): Spine {
  if (points.length === 0) {
    return { d: '', samples: [], pointLengths: [], total: 0 };
  }

  const samples: Spine['samples'] = [{ ...points[0], length: 0 }];
  const pointLengths = [0];
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  let length = 0;
  let last = points[0];

  for (let i = 0; i < points.length - 1; i += 1) {
    const { p1, p2, c1, c2 } = controls(points, i);
    d +=
      ` C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}` +
      ` ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}` +
      ` ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;

    for (let s = 1; s <= SAMPLES_PER_SEGMENT; s += 1) {
      const t = s / SAMPLES_PER_SEGMENT;
      const point = {
        x: cubicAt(p1.x, c1.x, c2.x, p2.x, t),
        y: cubicAt(p1.y, c1.y, c2.y, p2.y, t),
      };
      length += Math.hypot(point.x - last.x, point.y - last.y);
      samples.push({ ...point, length });
      last = point;
    }

    pointLengths.push(length);
  }

  return { d, samples, pointLengths, total: length };
}

/** Position on the spine at a given length, clamped to the ends. */
export function pointAtLength(spine: Spine, length: number): Point {
  const { samples } = spine;

  if (samples.length === 0) {
    return { x: 0, y: 0 };
  }

  if (length <= 0) {
    return { x: samples[0].x, y: samples[0].y };
  }

  const end = samples[samples.length - 1];

  if (length >= end.length) {
    return { x: end.x, y: end.y };
  }

  /* Binary search the first sample at or past the length. */
  let lo = 0;
  let hi = samples.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].length < length) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const b = samples[lo];
  const a = samples[lo - 1] ?? b;
  const span = b.length - a.length || 1;
  const t = (length - a.length) / span;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * A camera over the atlas: the point at the centre of the panel and how many
 * atlas units span the panel's width. Height follows the panel's aspect, so a
 * wide panel simply sees more north and south.
 */
export type Camera = { cx: number; cy: number; w: number };

export type Viewport = { width: number; height: number };

export function cameraScale(camera: Camera, viewport: Viewport) {
  return viewport.width / camera.w;
}

/** Atlas point → panel pixels. */
export function project(camera: Camera, viewport: Viewport, point: Point) {
  const scale = cameraScale(camera, viewport);
  return {
    x: (point.x - camera.cx) * scale + viewport.width / 2,
    y: (point.y - camera.cy) * scale + viewport.height / 2,
  };
}

/** Panel pixels → atlas point (for placing the ending's pin by hand). */
export function unproject(camera: Camera, viewport: Viewport, pixel: Point) {
  const scale = cameraScale(camera, viewport);
  return {
    x: (pixel.x - viewport.width / 2) / scale + camera.cx,
    y: (pixel.y - viewport.height / 2) / scale + camera.cy,
  };
}

/** The SVG group transform that puts the atlas under this camera. */
export function cameraTransform(camera: Camera, viewport: Viewport) {
  const scale = cameraScale(camera, viewport);
  return (
    `translate(${(viewport.width / 2).toFixed(2)} ${(viewport.height / 2).toFixed(2)})` +
    ` scale(${scale.toFixed(5)})` +
    ` translate(${(-camera.cx).toFixed(3)} ${(-camera.cy).toFixed(3)})`
  );
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * A camera flight: the centre eases between the two framings while the width
 * pulls out mid-flight in proportion to the distance travelled, so a hop
 * across the country reads as lift, cross, and settle rather than a smear.
 */
export function flyCamera(from: Camera, to: Camera, t: number): Camera {
  const e = easeInOutCubic(t);
  const distance = Math.hypot(to.cx - from.cx, to.cy - from.cy);
  const wide = Math.max(from.w, to.w);
  const lift = Math.min(distance * 0.9, 1100 - wide);
  return {
    cx: from.cx + (to.cx - from.cx) * e,
    cy: from.cy + (to.cy - from.cy) * e,
    w: from.w + (to.w - from.w) * e + Math.max(lift, 0) * Math.sin(Math.PI * t),
  };
}

/** Flight time grows with distance, capped so a coast-to-coast hop stays brisk. */
export function flightDuration(from: Camera, to: Camera) {
  const distance = Math.hypot(to.cx - from.cx, to.cy - from.cy);
  const zoom = Math.abs(Math.log(to.w / from.w));
  return 700 + Math.min(distance / 900, 1) * 700 + Math.min(zoom, 1.5) * 200;
}
