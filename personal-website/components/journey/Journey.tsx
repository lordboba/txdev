'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useSyncExternalStore } from 'react';
import {
  journeyArtifacts,
  journeyBeats,
  journeyMaps,
  journeyNodes,
  orderedBeatIds,
  type JourneyArtifact,
  type JourneyBeat,
  type JourneyMapNode,
} from '../../content/journeyData';
import { usePrefersReducedMotion } from '../concept/shared/runtime';
import {
  closeJourneyIndex,
  collectJourneyKeepsake,
  consumeJourneyFocus,
  enterJourneyChapter,
  escapeJourney,
  finishJourney,
  moveJourneyToNode,
  nextJourneyBeat,
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

const wakeBeat = journeyBeats[0];
const finalBeat = journeyBeats.find((beat) => beat.nextId === null) ?? wakeBeat;
/** The wake beat is the screen itself, so the chapter count starts after it. */
const chapterTotal = String(orderedBeatIds.length - 1).padStart(2, '0');

function chapterNumber(beatId: string) {
  return String(Math.max(orderedBeatIds.indexOf(beatId), 0)).padStart(2, '0');
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

/** Catmull-Rom through every point, so the route actually visits each node. */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) {
    return '';
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d +=
      ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}` +
      ` ${c2x.toFixed(2)} ${c2y.toFixed(2)}` +
      ` ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
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

function WakeScreen({ phase }: { phase: 'waking' | 'ready' }) {
  const [question, line, action] = wakeBeat.story;

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
      data-phase={phase}
      onPointerEnter={wakeJourney}
    >
      <p className={styles.wakeEyebrow}>
        Personal env / a short route, 4-6 min
      </p>
      <h1 className={styles.wakeQuestion}>{question}</h1>
      {phase === 'ready' ? (
        <>
          <p className={styles.wakeLine}>{line}</p>
          <div className={styles.wakeActions}>
            <button
              className={styles.primaryAction}
              onClick={() => enterJourneyChapter()}
              ref={primaryRef}
              type="button"
            >
              {(action ?? 'Learn more.').replace(/\.$/, '')}
            </button>
            <button
              className={styles.ghostAction}
              onClick={() => enterJourneyChapter(undefined, 'read')}
              type="button"
            >
              Read without playing
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
          Wake the display
        </button>
      )}
    </section>
  );
}

function NodeButton({
  collected,
  currentNodeId,
  node,
  visited,
}: {
  collected: boolean;
  currentNodeId: string;
  node: JourneyMapNode;
  visited: boolean;
}) {
  return (
    <button
      aria-current={node.id === currentNodeId ? 'location' : undefined}
      aria-label={node.label}
      className={node.kind === 'main' ? styles.nodeMain : styles.nodeSide}
      data-collected={collected ? 'true' : undefined}
      data-flip={node.x > 58 ? 'true' : undefined}
      data-visited={visited ? 'true' : undefined}
      onClick={() => handleNodeClick(node)}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      type="button"
    />
  );
}

function RouteMap({
  currentNodeId,
  progress,
}: {
  currentNodeId: string;
  progress: JourneyProgress;
}) {
  const currentNode = nodesById.get(currentNodeId);

  /*
   * One persistent printed route: the full spine is always the dashed future
   * path, and amber overlays only the contiguous visited prefix — amber means
   * "travelled so far", and a skipped chapter never erases a landmark. The
   * wake beat counts as visited: the wake screen is that beat.
   */
  const visitedPrefix: typeof orderedMainNodes = [];
  for (const node of orderedMainNodes) {
    if (
      node.beatId !== wakeBeat.id &&
      !progress.visitedBeatIds.includes(node.beatId)
    ) {
      break;
    }

    visitedPrefix.push(node);
  }

  return (
    <div aria-label="Route map" className={styles.map} role="group">
      <button
        className={styles.backAction}
        onClick={() => escapeJourney()}
        type="button"
      >
        &lsaquo; Back
      </button>
      <span className={styles.mapLabelTop}>The route so far</span>
      <span className={styles.mapLabelBottom}>
        Arrow keys or tap a place &middot; Enter opens
      </span>

      <svg
        aria-hidden="true"
        className={styles.route}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
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
        <path className={styles.routeFuture} d={smoothPath(orderedMainNodes)} />
        <path className={styles.routePast} d={smoothPath(visitedPrefix)} />
      </svg>

      {currentNode ? (
        <span
          aria-hidden="true"
          className={styles.token}
          style={{ left: `${currentNode.x}%`, top: `${currentNode.y}%` }}
        />
      ) : null}

      {journeyNodes.map((node) => (
        <NodeButton
          collected={
            node.kind === 'side' && progress.keepsakes.includes(node.artifactId)
          }
          currentNodeId={currentNodeId}
          key={node.id}
          node={node}
          visited={
            node.kind === 'main' &&
            progress.visitedBeatIds.includes(node.beatId)
          }
        />
      ))}
    </div>
  );
}

function ArtifactFrame({ artifact }: { artifact: JourneyArtifact | null }) {
  if (!artifact) {
    return null;
  }

  if (artifact.id === 'unprinted-margin') {
    return <div aria-hidden="true" className={styles.artifactMargin} />;
  }

  return (
    <figure className={styles.artifact}>
      {artifact.asset ? (
        <div className={styles.artifactImage}>
          <Image
            alt={artifact.label}
            className={styles.artifactImg}
            fill
            sizes="(max-width: 700px) 92vw, 30vw"
            src={artifact.asset}
          />
        </div>
      ) : (
        <div className={styles.artifactPlaceholder}>{artifact.label}</div>
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
          None yet &mdash; side paths leave one.
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
          Story index
        </button>
      </div>

      <div className={styles.storyBody} key={beat.id}>
        <p className={styles.eyebrow}>
          {map?.placeLabel ?? beat.mapId} &middot; Chapter {number}
        </p>
        <h2 className={styles.storyTitle}>{beat.title}</h2>
        <p className={styles.period}>{beat.period}</p>
        <ArtifactFrame artifact={artifact} />
        {cleanStory(beat).map((paragraph) => (
          <p className={styles.storyText} key={paragraph}>
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
    <section aria-label="Story index" className={styles.index}>
      <div className={styles.indexHead}>
        <p className={styles.eyebrow}>Story index</p>
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
        {orderedBeatIds.map((beatId) => {
          const beat = beatsById.get(beatId);

          if (!beat) {
            return null;
          }

          const map = mapsById.get(beat.mapId);
          const visited = progress.visitedBeatIds.includes(beatId);

          return (
            <li key={beatId}>
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
  standalone,
}: {
  keepsakes: string[];
  onExit?: () => void;
  standalone: boolean;
}) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);

  const placePin = (event: React.MouseEvent<HTMLButtonElement>) => {
    /* A keyboard activation has no coordinates; give the pin open water. */
    if (event.clientX === 0 && event.clientY === 0) {
      setPin({ x: 58, y: 34 });
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setPin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section className={styles.ending}>
      <button
        aria-label="Place the next pin somewhere in the unprinted margin"
        className={styles.margin}
        onClick={placePin}
        ref={swapFocusRef}
        type="button"
      >
        <span className={styles.mapLabelTop}>The unprinted margin</span>
        {pin ? (
          <span
            aria-hidden="true"
            className={styles.pin}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          />
        ) : (
          <span className={styles.marginHint}>
            Place the next pin &mdash; tap anywhere
          </span>
        )}
      </button>

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
            ? `Pin placed in the unprinted margin — ${finalBeat.title}`
            : `No finish line — ${finalBeat.title}`}
        </p>
        <div className={styles.storyBody}>
          <p className={styles.eyebrow}>
            {mapsById.get(finalBeat.mapId)?.placeLabel ?? 'Horizon'} &middot; No
            finish line
          </p>
          <h2 className={styles.storyTitle}>{finalBeat.title}</h2>
          {pin ? (
            <>
              {cleanStory(finalBeat).map((paragraph) => (
                <p className={styles.storyText} key={paragraph}>
                  {paragraph}
                </p>
              ))}
              <p className={styles.period}>The pin stays unlabelled for now.</p>
            </>
          ) : (
            <p className={styles.storyText}>
              The printed route ends here. Put one pin anywhere in the margin
              &mdash; nobody knows the label yet, including the mapmaker.
            </p>
          )}
        </div>

        <KeepsakeLedger keepsakes={keepsakes} />

        {pin ? (
          <div className={styles.storyFooter}>
            <button
              className={styles.pagerAction}
              onClick={resetJourney}
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
      <p className={styles.eyebrow}>The map lost its place</p>
      <p className={styles.storyText}>
        The chapter copy is safe. Pick the route back up where it still
        resolves.
      </p>
      <button
        className={styles.primaryAction}
        onClick={recoverJourney}
        ref={swapFocusRef}
        type="button"
      >
        Recover the story
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
    >
      {standalone ? (
        <header className={styles.rail}>
          <Link className={styles.railLink} href="/">
            &larr; tylerx.dev
          </Link>
          <span className={styles.railTitle}>Tyler Xiao / Journey</span>
          <span className={styles.railMeta}>No fail state. No score.</span>
        </header>
      ) : null}

      <div className={styles.stage}>
        {state.status === 'screen' || state.status === 'closed' ? (
          <WakeScreen
            phase={state.status === 'screen' ? state.phase : 'waking'}
          />
        ) : null}

        {state.status === 'chapter' ? (
          <div className={styles.chapter} data-mode={state.mode}>
            <RouteMap currentNodeId={state.nodeId} progress={progress} />
            <StoryPanel progress={progress} state={state} />
          </div>
        ) : null}

        {state.status === 'index' ? <IndexView progress={progress} /> : null}

        {state.status === 'ending' ? (
          <EndingView
            keepsakes={state.keepsakes}
            onExit={onExit}
            standalone={standalone}
          />
        ) : null}

        {state.status === 'error' ? <ErrorView /> : null}
      </div>
    </div>
  );
}
