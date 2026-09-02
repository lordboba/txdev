/**
 * The atlas's motion budget, in one place: a camera that flies between
 * framings, a token that travels the route, and the amber stroke that draws
 * under it. One requestAnimationFrame loop runs only while something is in
 * flight and hands each frame to a single `apply` callback that writes the
 * DOM directly — React re-renders on state changes, never per frame.
 *
 * The last frame persists at module level so a remount (story index → chapter)
 * resumes from where the camera and token were instead of replaying the intro.
 */

import {
  easeInOutCubic,
  easeOutQuint,
  flightDuration,
  flyCamera,
  pointAtLength,
  type Camera,
  type Point,
  type Spine,
  type Viewport,
} from './routeGeometry';

export type MotionFrame = {
  camera: Camera;
  /** Atlas-space position of the "you are here" token. */
  token: Point;
  /** Length of the spine drawn in amber, in spine units. */
  drawn: number;
  /** True while the token is travelling. */
  travelling: boolean;
};

type CameraFlight = {
  from: Camera;
  to: Camera;
  start: number;
  duration: number;
};

type TokenTravel =
  | {
      kind: 'spine';
      from: number;
      to: number;
      start: number;
      duration: number;
    }
  | {
      kind: 'line';
      from: Point;
      to: Point;
      start: number;
      duration: number;
    };

type DrawnTween = { from: number; to: number; start: number; duration: number };

export type AtlasMotion = {
  setViewport(viewport: Viewport): void;
  /** Fly the camera to a framing; `delay` holds the current view first. */
  flyTo(camera: Camera, options?: { delay?: number; instant?: boolean }): void;
  /** Move the token along the spine between two spine lengths. */
  travelAlong(fromLength: number, toLength: number): void;
  /** Move the token in a straight line to an atlas point. */
  travelTo(point: Point): void;
  /** Extend (or cut back) the amber stroke to a spine length. */
  draw(length: number): void;
  /** Register the DOM writer; called at least once immediately. */
  subscribe(apply: (frame: MotionFrame) => void): () => void;
  snapshot(): MotionFrame;
  viewport(): Viewport;
  /** True when this mount picked up a persisted frame from an earlier one. */
  resumed: boolean;
  /** Stop the loop; the last frame stays persisted for the next mount. */
  destroy(): void;
};

let persisted: MotionFrame | null = null;

/** Where a fresh journey starts: the whole country, token at the first node. */
export function resetAtlasMotion() {
  persisted = null;
}

export function createAtlasMotion(options: {
  spine: Spine;
  initial: Omit<MotionFrame, 'travelling'>;
  /** Read at schedule time, so a preference change lands mid-journey. */
  reducedMotion: () => boolean;
}): AtlasMotion {
  const { spine, reducedMotion } = options;
  const resumed = persisted !== null;
  let frame: MotionFrame = persisted ?? {
    ...options.initial,
    travelling: false,
  };
  let viewport: Viewport = { width: 1, height: 1 };
  let flight: CameraFlight | null = null;
  let travel: TokenTravel | null = null;
  let drawnTween: DrawnTween | null = null;
  let raf = 0;
  let apply: ((frame: MotionFrame) => void) | null = null;
  let destroyed = false;

  const now = () =>
    typeof performance === 'undefined' ? Date.now() : performance.now();

  function progress(start: number, duration: number, time: number) {
    if (duration <= 0) {
      return 1;
    }
    return Math.min(Math.max((time - start) / duration, 0), 1);
  }

  function step() {
    raf = 0;
    const time = now();
    let active = false;

    let camera = frame.camera;
    if (flight) {
      const t = progress(flight.start, flight.duration, time);
      camera = t >= 1 ? flight.to : flyCamera(flight.from, flight.to, t);
      if (t >= 1) {
        flight = null;
      } else {
        active = true;
      }
    }

    let token = frame.token;
    let tokenLength: number | null = null;
    if (travel) {
      const t = progress(travel.start, travel.duration, time);
      const e = easeInOutCubic(t);
      if (travel.kind === 'spine') {
        tokenLength = travel.from + (travel.to - travel.from) * e;
        token = pointAtLength(spine, tokenLength);
      } else {
        token = {
          x: travel.from.x + (travel.to.x - travel.from.x) * e,
          y: travel.from.y + (travel.to.y - travel.from.y) * e,
        };
      }
      if (t >= 1) {
        travel = null;
      } else {
        active = true;
      }
    }

    let drawn = frame.drawn;
    if (drawnTween) {
      const t = progress(drawnTween.start, drawnTween.duration, time);
      const forward = drawnTween.to > drawnTween.from;
      /*
       * The pen follows the token: while the token travels forward over
       * unvisited route, the amber stroke draws exactly under it. Any other
       * change (a jump back, a reset) eases on its own clock.
       */
      if (forward && tokenLength !== null) {
        drawn = Math.min(Math.max(tokenLength, drawnTween.from), drawnTween.to);
      } else {
        drawn =
          drawnTween.from + (drawnTween.to - drawnTween.from) * easeOutQuint(t);
      }
      if (t >= 1 && travel === null) {
        drawn = drawnTween.to;
        drawnTween = null;
      } else {
        active = true;
      }
    }

    frame = { camera, token, drawn, travelling: travel !== null };
    persisted = frame;
    apply?.(frame);

    if (active && !destroyed) {
      raf = requestAnimationFrame(step);
    }
  }

  function schedule() {
    if (destroyed) {
      return;
    }
    if (reducedMotion()) {
      /* Cut, do not travel: collapse every tween to its end and paint once. */
      if (flight) {
        flight = { ...flight, start: -Infinity, duration: 0 };
      }
      if (travel) {
        travel = { ...travel, start: -Infinity, duration: 0 };
      }
      if (drawnTween) {
        drawnTween = { ...drawnTween, start: -Infinity, duration: 0 };
      }
    }
    if (!raf) {
      raf = requestAnimationFrame(step);
    }
  }

  return {
    resumed,
    setViewport(next) {
      if (next.width === viewport.width && next.height === viewport.height) {
        return;
      }
      viewport = next;
      apply?.(frame);
    },
    flyTo(camera, flyOptions) {
      const same =
        camera.cx === frame.camera.cx &&
        camera.cy === frame.camera.cy &&
        camera.w === frame.camera.w;
      if (same && !flight) {
        return;
      }
      const instant = flyOptions?.instant ?? false;
      flight = {
        from: frame.camera,
        to: camera,
        start: now() + (flyOptions?.delay ?? 0),
        duration: instant ? 0 : flightDuration(frame.camera, camera),
      };
      schedule();
    },
    travelAlong(fromLength, toLength) {
      const distance = Math.abs(toLength - fromLength);
      travel = {
        kind: 'spine',
        from: fromLength,
        to: toLength,
        start: now(),
        duration: 650 + Math.min(distance / 300, 1) * 550,
      };
      schedule();
    },
    travelTo(point) {
      travel = {
        kind: 'line',
        from: frame.token,
        to: point,
        start: now(),
        duration: 520,
      };
      schedule();
    },
    draw(length) {
      if (length === frame.drawn && !drawnTween) {
        return;
      }
      drawnTween = {
        from: frame.drawn,
        to: length,
        start: now(),
        duration: travel ? travel.duration : 600,
      };
      schedule();
    },
    subscribe(next) {
      apply = next;
      next(frame);
      return () => {
        if (apply === next) {
          apply = null;
        }
      };
    },
    snapshot: () => frame,
    viewport: () => viewport,
    destroy() {
      destroyed = true;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      /*
       * Land the token and the stroke so the next mount resumes on solid
       * ground; the camera stays exactly where it was, so a remount continues
       * the flight (and a dev-mode double mount still plays the intro).
       */
      if (travel) {
        frame = {
          ...frame,
          token:
            travel.kind === 'spine'
              ? pointAtLength(spine, travel.to)
              : travel.to,
        };
      }
      if (drawnTween) {
        frame = { ...frame, drawn: drawnTween.to };
      }
      frame = { ...frame, travelling: false };
      persisted = frame;
    },
  };
}
