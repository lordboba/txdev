'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  journeyArtifacts,
  journeyBeats,
  journeyMaps,
  journeyNodes,
  orderedBeatIds,
  type JourneyArtifact,
  type JourneyBeat,
  type JourneyMap,
  type JourneyMapId,
  type JourneyMapNode,
} from '../../content/journeyData';
import {
  usMapHeight,
  usMapWidth,
  usNationPath,
  usStateBordersPath,
} from '../../content/usMapGenerated';
import { usePrefersReducedMotion } from '../concept/shared/runtime';
import {
  createAtlasMotion,
  resetAtlasMotion,
  type AtlasMotion,
  type MotionFrame,
} from './journeyMotion';
import {
  closeJourneyIndex,
  collectJourneyKeepsake,
  consumeJourneyFocus,
  enterJourneyChapter,
  escapeJourney,
  finishJourney,
  moveJourneyInDirection,
  moveJourneyToNode,
  nextJourneyBeat,
  openJourneyBeat,
  openJourneyIndex,
  prevJourneyBeat,
  readJourneyProgress,
  readJourneyState,
  recoverJourney,
  resetJourney,
  setJourneyEmbedded,
  setJourneyMode,
  subscribeJourneyProgress,
  subscribeJourneyState,
  wakeJourney,
  type JourneyProgress,
  type JourneyState,
} from './journeyStore';
import {
  buildSpine,
  cameraScale,
  cameraTransform,
  project,
  unproject,
  type Camera,
  type Point,
} from './routeGeometry';
import styles from './Journey.module.css';

type MainNode = Extract<JourneyMapNode, { kind: 'main' }>;
type SideNode = Extract<JourneyMapNode, { kind: 'side' }>;

const beatsById = new Map(journeyBeats.map((beat) => [beat.id, beat]));
const nodesById = new Map(journeyNodes.map((node) => [node.id, node]));
const artifactsById = new Map(
  journeyArtifacts.map((artifact) => [artifact.id, artifact]),
);
const mapsById = new Map(journeyMaps.map((map) => [map.id, map]));
const mainNodeByBeatId = new Map<string, MainNode>(
  journeyNodes
    .filter((node): node is MainNode => node.kind === 'main')
    .map((node) => [node.beatId, node]),
);
const sideNodes = journeyNodes.filter(
  (node): node is SideNode => node.kind === 'side',
);

/** Main nodes in story order — the spine the route is drawn through. */
const orderedMainNodes = orderedBeatIds
  .map((beatId) => mainNodeByBeatId.get(beatId))
  .filter((node): node is MainNode => node !== undefined);

/** The route, sampled once: the token travels it and the amber draws along it. */
const spine = buildSpine(orderedMainNodes);
const spineLengthByNodeId = new Map(
  orderedMainNodes.map((node, index) => [node.id, spine.pointLengths[index]]),
);

const wakeBeat = journeyBeats[0];
const finalBeat = journeyBeats.find((beat) => beat.nextId === null) ?? wakeBeat;
/** The wake beat is the screen itself, so the chapter count starts after it. */
const chapterTotal = String(orderedBeatIds.length - 1).padStart(2, '0');

/**
 * Camera framings over the atlas (see routeGeometry.Camera). `national` is
 * the whole lower 48; each map is a regional lean-in around its real city,
 * wide enough that the neighbouring city stays in frame as context.
 */
type CameraId = JourneyMapId | 'national' | 'ending';

const cameras: Record<CameraId, Camera> = {
  national: { cx: usMapWidth / 2, cy: usMapHeight / 2, w: 1060 },
  'san-diego': { cx: 122, cy: 386, w: 168 },
  ucla: { cx: 104, cy: 376, w: 180 },
  'san-francisco': { cx: 66, cy: 306, w: 270 },
  'new-york': { cx: 872, cy: 224, w: 210 },
  horizon: { cx: 940, cy: 222, w: 330 },
  ending: { cx: 575, cy: 300, w: 1190 },
};

/** Where a keyboard-placed pin lands: open Atlantic, east of the route. */
const defaultPin: Point = { x: 1040, y: 262 };

/** Under this many pixels per atlas unit, node labels would collide: hide them. */
const FAR_ZOOM_SCALE = 2.4;

function chapterNumber(beatId: string) {
  return String(Math.max(orderedBeatIds.indexOf(beatId), 0)).padStart(2, '0');
}

function formatCoordinates(lat: number, lng: number) {
  return (
    `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}` +
    `  ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`
  );
}

/**
 * Story copy exactly as the canonical data ships it, except that a beat still
 * waiting on Tyler renders without its bracketed placeholder sentences — a
 * visitor must never see editorial scaffolding.
 */
function cleanStory(beat: JourneyBeat): string[] {
  if (beat.editorialStatus !== 'needs-tyler') {
    return beat.story;
  }

  return beat.story
    .map((paragraph) =>
      paragraph
        .replace(/\s*\[[^\]]*\]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * Spine length of the furthest contiguous visited chapter: amber means
 * "travelled so far", and a skipped chapter never erases a landmark. The wake
 * beat counts as visited — the wake screen is that beat.
 */
function drawnLengthFor(progress: JourneyProgress) {
  let drawn = 0;

  for (const node of orderedMainNodes) {
    if (
      node.beatId !== wakeBeat.id &&
      !progress.visitedBeatIds.includes(node.beatId)
    ) {
      break;
    }

    drawn = spineLengthByNodeId.get(node.id) ?? drawn;
  }

  return drawn;
}

/**
 * Mount ref for each view's focus target. A view swap unmounts whatever held
 * keyboard focus, so the store flags status changes and the incoming view's
 * anchor element claims focus exactly once on mount — never on page load,
 * which the store never flags. Stable identity: React runs it on mount only.
 */
function swapFocusRef(element: HTMLElement | null) {
  if (element && consumeJourneyFocus()) {
    element.focus();
  }
}

/** A new chapter's body mounts at the top of the record, not mid-scroll. */
function scrollToTop(element: HTMLElement | null) {
  element?.parentElement?.scrollTo({ top: 0 });
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Waypoint travel from the keyboard: arrows step to the adjacent node in
 * that screen direction, Enter opens whatever the token stands on. Buttons
 * and links keep their own Enter; a move that is not adjacent falls through
 * untouched so the page never swallows a key it did nothing with.
 */
function handleChapterKey(event: React.KeyboardEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  const onControl = target.closest('button, a, input, textarea, select');

  if (event.key === 'Enter' && !onControl) {
    event.preventDefault();
    openJourneyBeat();
    return;
  }

  const arrow = ARROWS[event.key];

  if (arrow && moveJourneyInDirection(arrow[0], arrow[1])) {
    event.preventDefault();
  }
}

function useJourneyState() {
  return useSyncExternalStore(
    subscribeJourneyState,
    readJourneyState,
    readJourneyState,
  );
}

function useJourneyProgress() {
  return useSyncExternalStore(
    subscribeJourneyProgress,
    readJourneyProgress,
    readJourneyProgress,
  );
}

/**
 * Tapping is never gated: a main node is always a valid jump, and a side node
 * that is not adjacent first travels to its anchor and then steps across.
 * Keyboard arrows stay adjacency-only — the waypoint feel without the wall.
 */
function handleNodeClick(node: JourneyMapNode) {
  if (node.kind === 'main') {
    enterJourneyChapter(node.beatId);
    return;
  }

  if (moveJourneyToNode(node.id)) {
    collectJourneyKeepsake(node.artifactId);
    return;
  }

  const anchor = node.adjacency
    .map((id) => nodesById.get(id))
    .find((candidate): candidate is MainNode => candidate?.kind === 'main');

  if (anchor) {
    enterJourneyChapter(anchor.beatId);
    moveJourneyToNode(node.id);
    collectJourneyKeepsake(node.artifactId);
  }
}

/**
 * Types the wake question one character at a time, like the laptop screen.
 * An external store rather than an effect: the timer runs only while a
 * subscriber is mounted, and a remount types the line fresh.
 */
function createTypewriter(text: string) {
  const listeners = new Set<() => void>();
  let typed = 0;
  let timer: number | null = null;

  const tick = () => {
    timer = null;
    if (typed >= text.length) {
      return;
    }
    typed += 1;
    listeners.forEach((listener) => listener());
    timer = window.setTimeout(tick, 46);
  };

  return {
    read: () => typed,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (timer === null && typed < text.length) {
        timer = window.setTimeout(tick, 420);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
          typed = 0;
        }
      };
    },
  };
}

function useTypewriter(text: string, reducedMotion: boolean) {
  const store = useMemo(() => createTypewriter(text), [text]);
  const typed = useSyncExternalStore(store.subscribe, store.read, () => 0);

  if (reducedMotion) {
    return { shown: text, done: true };
  }

  return { shown: text.slice(0, typed), done: typed >= text.length };
}

/* -------------------------------------------------------------------------- */
/* Wake screen                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The atlas as an attract screen: the country in hairline, the four real
 * cities, and the route drawing itself once the display wakes. Static SVG —
 * the camera only starts moving inside the chapters.
 */
/** The ghost atlas is drawn to fit (xMidYMid meet); this is where a point lands. */
function ghostPixel(frame: HTMLElement, point: Point) {
  const scale = Math.min(
    frame.clientWidth / usMapWidth,
    frame.clientHeight / usMapHeight,
  );
  return {
    x: (frame.clientWidth - usMapWidth * scale) / 2 + point.x * scale,
    y: (frame.clientHeight - usMapHeight * scale) / 2 + point.y * scale,
  };
}

/**
 * Keeps --pin-x/--pin-y on the frame pointing at San Diego so the HTML start
 * pin sits on the drawn map and the lean pivots on it. A ref callback with a
 * cleanup, so it follows every resize and never runs as an effect.
 */
function mountGhostFrame(frame: HTMLDivElement | null) {
  if (!frame) {
    return;
  }

  const start = journeyMaps[0].place;
  const place = () => {
    const pixel = ghostPixel(frame, start);
    frame.style.setProperty('--pin-x', `${pixel.x.toFixed(1)}px`);
    frame.style.setProperty('--pin-y', `${pixel.y.toFixed(1)}px`);
  };

  place();
  const observer = new ResizeObserver(place);
  observer.observe(frame);

  return () => observer.disconnect();
}

/**
 * The atlas as an attract screen: the country in hairline, the four real
 * cities, the route drawing itself once the display wakes, and San Diego's
 * pin as a second door into the map. Static SVG — the camera only starts
 * moving inside the chapters.
 */
function GhostAtlas({
  action,
  onLean,
  phase,
}: {
  action: string;
  onLean: (lean: boolean) => void;
  phase: 'waking' | 'ready';
}) {
  return (
    <div className={styles.ghostFrame} ref={mountGhostFrame}>
      <svg
        aria-hidden="true"
        className={styles.ghost}
        data-phase={phase}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${usMapWidth} ${usMapHeight}`}
      >
        <path className={styles.ghostNation} d={usNationPath} />
        <path className={styles.ghostBorders} d={usStateBordersPath} />
        <path className={styles.ghostRoute} d={spine.d} pathLength={1} />
        {journeyMaps
          .filter((map) => map.id !== 'horizon')
          .map((map) => (
            <circle
              className={styles.ghostCity}
              cx={map.place.x}
              cy={map.place.y}
              key={map.id}
              r={2.6}
            />
          ))}
      </svg>
      {/* Pointer-only twin of the primary button: keyboard users already
          have the button, so this stays out of the tab order. */}
      {phase === 'ready' ? (
        <button
          aria-hidden="true"
          aria-label={action}
          className={styles.startPin}
          onClick={() => enterJourneyChapter()}
          onPointerEnter={() => onLean(true)}
          onPointerLeave={() => onLean(false)}
          tabIndex={-1}
          type="button"
        />
      ) : null}
    </div>
  );
}

function WakeScreen({
  phase,
  reducedMotion,
}: {
  phase: 'waking' | 'ready';
  reducedMotion: boolean;
}) {
  const [question, line, affordance] = wakeBeat.story;
  const action = (affordance ?? 'Start in San Diego.').replace(/\.$/, '');
  const { shown, done } = useTypewriter(question, reducedMotion);
  /* Reaching for the door leans the atlas toward San Diego. */
  const [lean, setLean] = useState(false);

  /*
   * Waking via keyboard focus unmounts the hint button under the visitor's
   * focus, so the hint flags the handoff and the primary action that replaces
   * it claims focus on mount. A hover wake never sets the flag — pointer
   * users keep their focus wherever it was.
   */
  const handoff = useRef(false);

  const primaryRef = (element: HTMLButtonElement | null) => {
    if (!element) {
      return;
    }

    if (handoff.current) {
      handoff.current = false;
      element.focus();
      return;
    }

    swapFocusRef(element);
  };

  return (
    <section
      className={styles.wake}
      data-lean={lean ? 'true' : undefined}
      data-phase={phase}
      data-typed={done ? 'true' : undefined}
      onPointerEnter={wakeJourney}
    >
      <GhostAtlas action={action} onLean={setLean} phase={phase} />
      <div className={styles.wakeInner}>
        <p className={styles.wakeEyebrow}>
          Tyler Xiao / a short route, 4 to 6 minutes
        </p>
        <h1 aria-label={question} className={styles.wakeQuestion}>
          <span aria-hidden="true">{shown}</span>
          <span aria-hidden="true" className={styles.caret} />
        </h1>
        {phase === 'ready' ? (
          <>
            <p className={styles.wakeLine}>{line}</p>
            <div className={styles.wakeActions}>
              <button
                className={styles.primaryAction}
                onBlur={() => setLean(false)}
                onClick={() => enterJourneyChapter()}
                onFocus={() => setLean(true)}
                onPointerEnter={() => setLean(true)}
                onPointerLeave={() => setLean(false)}
                ref={primaryRef}
                type="button"
              >
                {action}
                <span aria-hidden="true" className={styles.primaryArrow}>
                  &rarr;
                </span>
              </button>
              <button
                className={styles.ghostAction}
                onClick={() => enterJourneyChapter(undefined, 'read')}
                type="button"
              >
                or read it as text
              </button>
            </div>
          </>
        ) : (
          <button
            className={styles.wakeHint}
            onClick={wakeJourney}
            onFocus={() => {
              handoff.current = true;
              wakeJourney();
            }}
            ref={swapFocusRef}
            type="button"
          >
            Wake the screen
          </button>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Route map: the atlas under a moving camera                                  */
/* -------------------------------------------------------------------------- */

/**
 * Which node the token last stood on, across mounts: the story index unmounts
 * the map, and on return the token should travel from where it was, not
 * teleport. Cleared with the journey.
 */
let lastTokenNodeId: string | null = null;

function restartJourney() {
  lastTokenNodeId = null;
  resetAtlasMotion();
  resetJourney();
}

function nodePoint(nodeId: string): Point {
  const node = nodesById.get(nodeId);
  return node
    ? { x: node.x, y: node.y }
    : { x: usMapWidth / 2, y: usMapHeight / 2 };
}

function NodeMarker({
  away,
  collected,
  current,
  inert,
  node,
  register,
  visited,
}: {
  away: boolean;
  collected: boolean;
  current: boolean;
  inert: boolean;
  node: JourneyMapNode;
  register: (id: string, element: HTMLElement | null) => void;
  visited: boolean;
}) {
  return (
    <span
      className={styles.marker}
      data-away={away ? 'true' : undefined}
      ref={(element) => register(node.id, element)}
    >
      <button
        aria-current={current ? 'location' : undefined}
        aria-label={node.label}
        className={node.kind === 'main' ? styles.nodeMain : styles.nodeSide}
        data-collected={collected ? 'true' : undefined}
        data-side={node.labelSide}
        data-visited={visited ? 'true' : undefined}
        onClick={() => handleNodeClick(node)}
        tabIndex={inert ? -1 : undefined}
        type="button"
      >
        <span aria-hidden="true" className={styles.nodeLabel}>
          {node.label}
        </span>
      </button>
    </span>
  );
}

function CityMarker({
  current,
  map,
  register,
}: {
  current: boolean;
  map: JourneyMap;
  register: (id: string, element: HTMLElement | null) => void;
}) {
  return (
    <span
      aria-hidden="true"
      className={styles.marker}
      data-current={current ? 'true' : undefined}
      ref={(element) => register(`city:${map.id}`, element)}
    >
      <span className={styles.cityRing} />
      <span className={styles.cityLabel} data-side={map.labelSide}>
        {map.place.name}
      </span>
    </span>
  );
}

/**
 * Resolve what the atlas should show for a journey state: which camera, which
 * node the token stands on, and how much route is lit. The ending lights the
 * whole route and parks the token on the final chapter.
 */
function atlasTargets(
  state: JourneyState,
  progress: JourneyProgress,
  ending: boolean,
) {
  if (ending) {
    return {
      cameraId: 'ending' as CameraId,
      nodeId: mainNodeByBeatId.get(finalBeat.id)?.id ?? orderedMainNodes[0].id,
      drawn: spine.total,
    };
  }

  if (state.status !== 'chapter') {
    return null;
  }

  return {
    cameraId: (beatsById.get(state.beatId)?.mapId ?? 'national') as CameraId,
    nodeId: state.nodeId,
    drawn: drawnLengthFor(progress),
  };
}

function RouteMap({
  currentMapId,
  currentNodeId,
  ending = false,
  onPick,
  pin = null,
  progress,
  reducedMotion,
}: {
  currentMapId: JourneyMapId;
  currentNodeId: string;
  /** The ending: whole route lit, nodes inert, the margin takes a pin. */
  ending?: boolean;
  onPick?: (point: Point) => void;
  pin?: Point | null;
  progress: JourneyProgress;
  reducedMotion: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<SVGGElement>(null);
  const pastRef = useRef<SVGPathElement>(null);
  const tokenRef = useRef<HTMLSpanElement>(null);
  const pinRef = useRef<HTMLSpanElement | null>(null);
  const markers = useRef(new Map<string, HTMLElement>());
  const motionRef = useRef<AtlasMotion | null>(null);

  /* Latest props for the mount closure and the per-frame writer. */
  const latest = useRef({ ending, pin, reducedMotion });
  latest.current = { ending, pin, reducedMotion };

  const map = mapsById.get(currentMapId);

  /*
   * One DOM writer for every frame. It reads the latest pin through the ref,
   * so the motion loop never calls a stale closure.
   */
  const paint = useCallback((frame: MotionFrame) => {
    const motion = motionRef.current;
    const root = rootRef.current;

    if (!motion || !root) {
      return;
    }

    const viewport = motion.viewport();
    const scale = cameraScale(frame.camera, viewport);

    /* The amber stroke reads this to stay 2px wide while dashing in atlas units. */
    root.style.setProperty('--atlas-scale', scale.toFixed(5));
    groupRef.current?.setAttribute(
      'transform',
      cameraTransform(frame.camera, viewport),
    );
    pastRef.current?.setAttribute(
      'stroke-dasharray',
      `${frame.drawn.toFixed(2)} ${(spine.total + 1).toFixed(2)}`,
    );
    root.dataset.zoom = scale < FAR_ZOOM_SCALE ? 'far' : 'near';
    root.dataset.travelling = frame.travelling ? 'true' : 'false';

    markers.current.forEach((element, id) => {
      const point = id.startsWith('city:')
        ? mapsById.get(id.slice(5) as JourneyMapId)?.place
        : nodesById.get(id);

      if (!point) {
        return;
      }

      const pixel = project(frame.camera, viewport, point);
      element.style.transform = `translate3d(${pixel.x.toFixed(1)}px, ${pixel.y.toFixed(1)}px, 0)`;
    });

    if (tokenRef.current) {
      const pixel = project(frame.camera, viewport, frame.token);
      tokenRef.current.style.transform = `translate3d(${pixel.x.toFixed(1)}px, ${pixel.y.toFixed(1)}px, 0)`;
    }

    const placed = latest.current.pin;
    if (pinRef.current && placed) {
      const pixel = project(frame.camera, viewport, placed);
      pinRef.current.style.transform = `translate3d(${pixel.x.toFixed(1)}px, ${pixel.y.toFixed(1)}px, 0)`;
    }
  }, []);

  /*
   * All of the map's mount work in one ref callback with a cleanup (React 19
   * — no effects): size the panel, start the motion loop, and subscribe the
   * loop to the journey store so travel, flights, and the amber stroke follow
   * every commit without a React render in between. Stable identity, so
   * React runs it exactly once per mount.
   */
  const mountMap = useCallback(
    (root: HTMLDivElement | null) => {
      rootRef.current = root;

      if (!root) {
        return;
      }

      const { ending: isEnding } = latest.current;
      const motion = createAtlasMotion({
        spine,
        reducedMotion: () => latest.current.reducedMotion,
        initial: {
          camera: cameras.national,
          token: nodePoint(lastTokenNodeId ?? currentNodeId),
          drawn: drawnLengthFor(readJourneyProgress()),
        },
      });
      motionRef.current = motion;
      motion.setViewport({
        width: root.clientWidth,
        height: root.clientHeight,
      });

      const observer = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect) {
          motion.setViewport({ width: rect.width, height: rect.height });
        }
      });
      observer.observe(root);

      const unsubscribePaint = motion.subscribe(paint);

      let cameraId: CameraId | null = null;
      let nodeId = lastTokenNodeId ?? currentNodeId;
      /* Record where the token stands even when this mount never travels. */
      lastTokenNodeId = nodeId;
      let first = true;

      const sync = () => {
        const targets = atlasTargets(
          readJourneyState(),
          readJourneyProgress(),
          isEnding,
        );

        if (!targets) {
          return;
        }

        if (targets.cameraId !== cameraId) {
          /* A fresh journey holds the whole country before leaning in. */
          motion.flyTo(cameras[targets.cameraId], {
            delay: first && !motion.resumed ? 520 : 0,
          });
          cameraId = targets.cameraId;
        }

        if (targets.nodeId !== nodeId) {
          const from = spineLengthByNodeId.get(nodeId);
          const to = spineLengthByNodeId.get(targets.nodeId);

          if (from !== undefined && to !== undefined) {
            motion.travelAlong(from, to);
          } else {
            motion.travelTo(nodePoint(targets.nodeId));
          }

          nodeId = targets.nodeId;
          lastTokenNodeId = nodeId;
        }

        motion.draw(targets.drawn);
        first = false;
      };

      sync();
      const unsubscribeState = subscribeJourneyState(sync);
      const unsubscribeProgress = subscribeJourneyProgress(sync);

      return () => {
        unsubscribeState();
        unsubscribeProgress();
        unsubscribePaint();
        observer.disconnect();
        motion.destroy();
        motionRef.current = null;
      };
    },
    /* Mount-only: later node changes arrive through the store subscription. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paint],
  );

  const register = (id: string, element: HTMLElement | null) => {
    if (element) {
      markers.current.set(id, element);
    } else {
      markers.current.delete(id);
    }
  };

  /* A newly placed pin mounts, then paints itself into position. */
  const mountPin = (element: HTMLSpanElement | null) => {
    pinRef.current = element;
    const motion = motionRef.current;
    if (element && motion) {
      paint(motion.snapshot());
    }
  };

  const pick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const motion = motionRef.current;
    const root = rootRef.current;

    if (!onPick || !motion || !root) {
      return;
    }

    /* A keyboard activation has no coordinates; give the pin open water. */
    if (event.clientX === 0 && event.clientY === 0) {
      onPick(defaultPin);
      return;
    }

    const rect = root.getBoundingClientRect();
    onPick(
      unproject(motion.snapshot().camera, motion.viewport(), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }),
    );
  };

  return (
    <div
      aria-label={ending ? 'The whole route' : 'Route map'}
      className={styles.map}
      data-ending={ending ? 'true' : undefined}
      ref={mountMap}
      role="group"
    >
      <svg aria-hidden="true" className={styles.atlas}>
        <g ref={groupRef}>
          <path className={styles.nation} d={usNationPath} />
          <path className={styles.borders} d={usStateBordersPath} />
          {sideNodes.map((side) => {
            const anchor = side.adjacency
              .map((id) => nodesById.get(id))
              .find((candidate) => candidate?.kind === 'main');

            if (!anchor) {
              return null;
            }

            return (
              <path
                className={styles.sideLink}
                d={`M ${anchor.x} ${anchor.y} L ${side.x} ${side.y}`}
                key={side.id}
              />
            );
          })}
          <path className={styles.routeFuture} d={spine.d} />
          <path
            className={styles.routePast}
            d={spine.d}
            pathLength={spine.total}
            ref={pastRef}
          />
        </g>
      </svg>

      <div aria-hidden={ending ? 'true' : undefined} className={styles.layer}>
        {journeyMaps
          .filter((candidate) => candidate.id !== 'horizon')
          .map((candidate) => (
            <CityMarker
              current={candidate.id === currentMapId}
              key={candidate.id}
              map={candidate}
              register={register}
            />
          ))}

        {journeyNodes.map((node) => (
          <NodeMarker
            away={node.mapId !== currentMapId}
            collected={
              node.kind === 'side' &&
              progress.keepsakes.includes(node.artifactId)
            }
            current={node.id === currentNodeId}
            inert={ending}
            key={node.id}
            node={node}
            register={register}
            visited={
              node.kind === 'main' &&
              progress.visitedBeatIds.includes(node.beatId)
            }
          />
        ))}

        <span aria-hidden="true" className={styles.token} ref={tokenRef}>
          <span className={styles.tokenMark} />
        </span>

        {pin ? (
          <span aria-hidden="true" className={styles.pin} ref={mountPin}>
            <span className={styles.pinRipple} />
            <span className={styles.pinMark} />
          </span>
        ) : null}
      </div>

      {onPick ? (
        <button
          aria-label="Place the next pin in the open water"
          className={styles.pickArea}
          onClick={pick}
          ref={swapFocusRef}
          type="button"
        />
      ) : null}

      {ending ? null : (
        <button
          className={styles.backAction}
          onClick={() => escapeJourney()}
          type="button"
        >
          &lsaquo; Back
        </button>
      )}
      <div className={styles.mapLabelTop}>
        <span>{ending ? 'Whole route' : 'Route so far'}</span>
        {ending ? (
          <span className={styles.mapHint}>
            {pin ? 'Pin placed' : 'Tap the open water to place the pin'}
          </span>
        ) : (
          <span className={styles.mapHint}>
            Arrow keys or tap a place &middot; Enter opens
          </span>
        )}
      </div>

      {map ? (
        <div className={styles.plate} key={map.id}>
          <span className={styles.plateName}>
            {map.locality ?? map.place.name}
            <span className={styles.plateRegion}>, {map.region}</span>
          </span>
          <span className={styles.plateCoords}>
            {formatCoordinates(map.place.lat, map.place.lng)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Story record                                                                */
/* -------------------------------------------------------------------------- */

function ArtifactFrame({ artifact }: { artifact: JourneyArtifact | null }) {
  if (!artifact) {
    return null;
  }

  if (artifact.id === 'unprinted-margin') {
    return <div aria-hidden="true" className={styles.artifactMargin} />;
  }

  /* A vector mark is ink: it needs paper behind it, not the dark frame. */
  const kind = artifact.asset?.endsWith('.svg') ? 'mark' : 'photo';

  return (
    <figure
      className={styles.artifact}
      style={{ '--i': 3 } as React.CSSProperties}
    >
      {artifact.asset ? (
        <div className={styles.artifactImage} data-kind={kind}>
          <Image
            alt={artifact.label}
            className={styles.artifactImg}
            fill
            sizes="(max-width: 700px) 92vw, 30vw"
            src={artifact.asset}
          />
        </div>
      ) : (
        <div className={styles.artifactPlaceholder}>
          <span>{artifact.label}</span>
          <span className={styles.artifactPending}>Photo to come</span>
        </div>
      )}
      <figcaption className={styles.artifactCaption}>
        {artifact.label}
      </figcaption>
    </figure>
  );
}

function KeepsakeLedger({ keepsakes }: { keepsakes: string[] }) {
  return (
    <div className={styles.ledger}>
      <span className={styles.ledgerLabel}>Keepsakes</span>
      {keepsakes.length === 0 ? (
        <span className={styles.ledgerEmpty}>
          None yet. Side paths add one.
        </span>
      ) : (
        <ul className={styles.ledgerList}>
          {keepsakes.map((id) => (
            <li key={id}>{artifactsById.get(id)?.label ?? id}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function rise(index: number) {
  return { '--i': index } as React.CSSProperties;
}

function StoryPanel({
  progress,
  state,
}: {
  progress: JourneyProgress;
  state: Extract<JourneyState, { status: 'chapter' }>;
}) {
  const beat = beatsById.get(state.beatId) ?? wakeBeat;
  const map = mapsById.get(beat.mapId);
  const artifact = artifactsById.get(beat.artifactIds[0]) ?? null;
  const reading = state.mode === 'read';
  const number = chapterNumber(beat.id);
  const isFirst = orderedBeatIds.indexOf(beat.id) <= 0;
  const isLast = beat.nextId === null;

  return (
    <aside
      aria-label="Chapter text"
      className={styles.story}
      data-journey-story
      ref={swapFocusRef}
      tabIndex={0}
    >
      {/*
       * The live region is this one small summary, not the whole panel: a
       * polite region wrapping the multi-paragraph body plus controls,
       * ledger, and footer would queue full-chapter readouts on every rapid
       * arrow-key page. The body itself is read on demand from the focused
       * panel; only where the visitor landed is announced.
       */}
      <p aria-live="polite" className={styles.srAnnounce}>
        Chapter {number} of {chapterTotal} &mdash; {beat.title},{' '}
        {map?.placeLabel ?? beat.mapId}
      </p>
      <div className={styles.storyControls}>
        <button
          aria-pressed={reading}
          className={styles.controlAction}
          onClick={() => setJourneyMode(reading ? 'explore' : 'read')}
          type="button"
        >
          Read without playing
        </button>
        <button
          className={styles.controlAction}
          onClick={openJourneyIndex}
          type="button"
        >
          All chapters
        </button>
      </div>

      <div className={styles.storyBody} key={beat.id} ref={scrollToTop}>
        <p className={styles.eyebrow} style={rise(0)}>
          {map?.placeLabel ?? beat.mapId} &middot; Chapter {number}
        </p>
        <h2 className={styles.storyTitle} style={rise(1)}>
          {beat.title}
        </h2>
        <p className={styles.period} style={rise(2)}>
          {beat.period}
        </p>
        <ArtifactFrame artifact={artifact} />
        {cleanStory(beat).map((paragraph, index) => (
          <p
            className={styles.storyText}
            key={paragraph}
            style={rise(4 + index)}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <KeepsakeLedger keepsakes={progress.keepsakes} />

      <div className={styles.storyFooter}>
        {reading ? (
          <button
            className={styles.pagerAction}
            disabled={isFirst}
            onClick={prevJourneyBeat}
            type="button"
          >
            &larr; Back
          </button>
        ) : null}
        <span className={styles.progressLabel}>
          {number} / {chapterTotal}
        </span>
        {isLast ? (
          <button
            className={styles.nextAction}
            onClick={finishJourney}
            type="button"
          >
            Place the next pin &rarr;
          </button>
        ) : (
          <button
            className={styles.nextAction}
            onClick={nextJourneyBeat}
            type="button"
          >
            Next chapter &rarr;
          </button>
        )}
      </div>
    </aside>
  );
}

function IndexView({ progress }: { progress: JourneyProgress }) {
  return (
    <section aria-label="All chapters" className={styles.index}>
      <div className={styles.indexHead}>
        <p className={styles.eyebrow}>All chapters</p>
        <button
          className={styles.controlAction}
          onClick={closeJourneyIndex}
          ref={swapFocusRef}
          type="button"
        >
          Close
        </button>
      </div>
      <ol className={styles.indexList}>
        {orderedBeatIds.map((beatId, index) => {
          const beat = beatsById.get(beatId);

          if (!beat) {
            return null;
          }

          const map = mapsById.get(beat.mapId);
          const visited = progress.visitedBeatIds.includes(beatId);

          return (
            <li key={beatId} style={rise(index)}>
              <button
                className={styles.indexRow}
                data-visited={visited ? 'true' : undefined}
                onClick={() => enterJourneyChapter(beatId)}
                type="button"
              >
                <span className={styles.indexNumber}>
                  {chapterNumber(beatId)}
                </span>
                <span>
                  <span className={styles.indexTitle}>{beat.title}</span>
                  <span className={styles.indexMeta}>
                    {map?.placeLabel ?? beat.mapId} &middot; {beat.period}
                  </span>
                </span>
                <span aria-hidden="true" className={styles.indexMark}>
                  {visited ? '■' : '□'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EndingView({
  keepsakes,
  onExit,
  progress,
  reducedMotion,
  standalone,
}: {
  keepsakes: string[];
  onExit?: () => void;
  progress: JourneyProgress;
  reducedMotion: boolean;
  standalone: boolean;
}) {
  const [pin, setPin] = useState<Point | null>(null);
  const finalNode = mainNodeByBeatId.get(finalBeat.id);

  return (
    <section className={styles.ending}>
      <RouteMap
        currentMapId={finalBeat.mapId}
        currentNodeId={finalNode?.id ?? orderedMainNodes[0].id}
        ending
        onPick={pin ? undefined : setPin}
        pin={pin}
        progress={progress}
        reducedMotion={reducedMotion}
      />

      <aside
        aria-label="Ending text"
        className={styles.story}
        data-journey-story
        tabIndex={0}
      >
        {/* Same narrow live region as the story panel: announce the arrival
            and the pin, never the whole re-rendered body. */}
        <p aria-live="polite" className={styles.srAnnounce}>
          {pin
            ? `Pin placed — ${finalBeat.title}`
            : `Ending — ${finalBeat.title}`}
        </p>
        {/* No key: placing the pin adds paragraphs, it does not re-run the
            eyebrow and title. */}
        <div className={styles.storyBody}>
          <p className={styles.eyebrow} style={rise(0)}>
            {`${mapsById.get(finalBeat.mapId)?.placeLabel ?? 'Next stop'} · Ending`}
          </p>
          <h2 className={styles.storyTitle} style={rise(1)}>
            {finalBeat.title}
          </h2>
          {pin ? (
            <>
              {cleanStory(finalBeat).map((paragraph, index) => (
                <p
                  className={styles.storyText}
                  key={paragraph}
                  style={rise(2 + index)}
                >
                  {paragraph}
                </p>
              ))}
              <p className={styles.period} style={rise(4)}>
                No label on the pin yet.
              </p>
            </>
          ) : (
            <p className={styles.storyText} style={rise(2)}>
              The route ends here for now. Tap the open water to place a pin for
              the next stop.
            </p>
          )}
        </div>

        <KeepsakeLedger keepsakes={keepsakes} />

        {pin ? (
          <div className={styles.storyFooter}>
            <button
              className={styles.pagerAction}
              onClick={restartJourney}
              type="button"
            >
              Start again
            </button>
            {standalone ? (
              <Link className={styles.nextAction} href="/">
                Return to the site &rarr;
              </Link>
            ) : (
              <button
                className={styles.nextAction}
                /*
                 * The labelled exit really exits: the spec's final action is
                 * "place one pin, then return to the Bench", so this closes
                 * the overlay outright — the one-level escapeJourney unwind
                 * stays reserved for the Escape key, which would otherwise
                 * land the visitor back inside the final chapter.
                 */
                onClick={onExit ?? (() => escapeJourney())}
                type="button"
              >
                Return &rarr;
              </button>
            )}
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function ErrorView() {
  return (
    <section className={styles.errorView} role="alert">
      <p className={styles.eyebrow}>Something went wrong</p>
      <p className={styles.storyText}>
        Your place on the map was lost. Recover to the last chapter that loaded.
      </p>
      <button
        className={styles.primaryAction}
        onClick={recoverJourney}
        ref={swapFocusRef}
        type="button"
      >
        Recover
      </button>
    </section>
  );
}

export function Journey({
  onExit,
  standalone = false,
}: {
  /** Embedded only: the ending's "Return" leaves the whole overlay. */
  onExit?: () => void;
  standalone?: boolean;
}) {
  /* Idempotent module write: the final Escape closes only an embedded run. */
  setJourneyEmbedded(!standalone);

  const state = useJourneyState();
  const progress = useJourneyProgress();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={styles.journey}
      data-reduced={reducedMotion ? 'true' : undefined}
      /* Embedded, the Bench's escape delegate owns the key; standalone, it
         unwinds one level here. */
      onKeyDown={
        standalone
          ? (event) => {
              if (event.key === 'Escape' && escapeJourney()) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      {standalone ? (
        <header className={styles.rail}>
          <Link className={styles.railLink} href="/">
            &larr; tylerx.dev
          </Link>
          <span className={styles.railTitle}>Tyler Xiao / Journey</span>
          <span className={styles.railMeta}>No score, no time limit.</span>
        </header>
      ) : null}

      <div className={styles.stage}>
        {state.status === 'screen' || state.status === 'closed' ? (
          <WakeScreen
            phase={state.status === 'screen' ? state.phase : 'waking'}
            reducedMotion={reducedMotion}
          />
        ) : null}

        {state.status === 'chapter' ? (
          <div
            className={styles.chapter}
            data-mode={state.mode}
            onKeyDown={handleChapterKey}
          >
            <RouteMap
              currentMapId={beatsById.get(state.beatId)?.mapId ?? 'san-diego'}
              currentNodeId={state.nodeId}
              progress={progress}
              reducedMotion={reducedMotion}
            />
            <StoryPanel progress={progress} state={state} />
          </div>
        ) : null}

        {state.status === 'index' ? <IndexView progress={progress} /> : null}

        {state.status === 'ending' ? (
          <EndingView
            keepsakes={state.keepsakes}
            onExit={onExit}
            progress={progress}
            reducedMotion={reducedMotion}
            standalone={standalone}
          />
        ) : null}

        {state.status === 'error' ? <ErrorView /> : null}
      </div>
    </div>
  );
}
