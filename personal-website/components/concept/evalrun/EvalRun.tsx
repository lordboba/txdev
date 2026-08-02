'use client';

import Image from 'next/image';
import { useCallback } from 'react';
import { conceptViews, type ConceptViewId } from '../conceptData';
import { setConceptView, useConceptView } from '../conceptViewStore';
import { usePrefersReducedMotion } from '../shared/runtime';
import type { ResolvedCase } from './runEngine';
import {
  enterSuite,
  getRunSnapshot,
  replaySuite,
  useRunSnapshot,
  useTimerTick,
} from './runStore';
import styles from './EvalRun.module.css';

function formatDuration(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function WallTimer() {
  useTimerTick();
  return (
    <span className={styles.timer}>
      {formatDuration(getRunSnapshot().elapsed)}
    </span>
  );
}

function CaseTimer({ caseId }: { caseId: string }) {
  useTimerTick();
  const entry = getRunSnapshot().cases.find(
    (caseSnapshot) => caseSnapshot.id === caseId,
  );

  return (
    <span className={styles.timer}>{formatDuration(entry?.elapsed ?? 0)}</span>
  );
}

function ProgressRule() {
  useTimerTick();
  const run = getRunSnapshot();
  const progress = run.cases.reduce((total, entry) => {
    if (entry.state === 'pass') {
      return total + 1;
    }

    if (entry.state === 'running') {
      return total + Math.min(0.92, entry.elapsed / entry.duration);
    }

    return total;
  }, 0);
  const percent = (progress / run.cases.length) * 100;

  return (
    <span
      aria-hidden="true"
      className={styles.progressValue}
      style={{ width: `${percent}%` }}
    />
  );
}

function Environment({
  environment,
}: {
  environment: NonNullable<
    ReturnType<typeof getRunSnapshot>['suite']['environment']
  >;
}) {
  return (
    <section className={styles.environment} aria-label="Suite environment">
      <div className={styles.environmentHead}>
        <span>environment</span>
        <span>company / period / detail</span>
      </div>
      <dl>
        {environment.map((entry) => (
          <div className={styles.environmentRow} key={entry.company}>
            <dt>{entry.company}</dt>
            <dd>{entry.period}</dd>
            <dd>{entry.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ArtifactAttachment({
  entry,
  priority,
}: {
  entry: ResolvedCase;
  priority: boolean;
}) {
  if (!entry.artifact || entry.state !== 'pass') {
    return null;
  }

  return (
    <a
      className={styles.artifact}
      href={entry.artifact.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className={styles.artifactHead}>
        <span>artifact.output</span>
        <span>{entry.artifact.label}</span>
        <span>artifact.url ↗</span>
      </span>
      <span className={styles.imageFrame}>
        <Image
          alt={`${entry.name} screenshot`}
          fill
          priority={priority}
          sizes="(max-width: 720px) 100vw, 1040px"
          src={entry.artifact.image}
        />
      </span>
    </a>
  );
}

function PaletteSwatches({ entry }: { entry: ResolvedCase }) {
  if (!entry.swatches || entry.state !== 'pass') {
    return null;
  }

  return (
    <div className={styles.swatches} aria-label="Recorded palette">
      {entry.swatches.map((swatch) => (
        <span className={styles.swatch} key={swatch}>
          {swatch}
        </span>
      ))}
    </div>
  );
}

function CaseRow({
  entry,
  priority,
}: {
  entry: ResolvedCase;
  priority: boolean;
}) {
  const assertion =
    entry.terminalState === 'pass' ? entry.assertion : entry.evidence;

  return (
    <article className={styles.case} data-state={entry.state}>
      <div className={styles.caseGrid}>
        <div className={styles.caseState}>
          <span className={styles.stateMark} aria-hidden="true" />
          <span>{entry.state.toUpperCase()}</span>
        </div>

        <div className={styles.caseBody}>
          <div className={styles.caseIdentity}>
            <code>{entry.id}</code>
            {entry.date ? (
              <time dateTime={entry.date}>{entry.date}</time>
            ) : null}
          </div>
          <h2>{entry.name}</h2>
          <p className={styles.assertion}>{assertion}</p>
          {entry.state === 'pass' ? (
            <p className={styles.evidence}>
              <span>evidence</span>
              {entry.evidence}
            </p>
          ) : null}
          <PaletteSwatches entry={entry} />
        </div>

        <CaseTimer caseId={entry.id} />
      </div>

      <ArtifactAttachment entry={entry} priority={priority} />
    </article>
  );
}

export function EvalRun() {
  const view = useConceptView();
  const reducedMotion = usePrefersReducedMotion();
  const run = useRunSnapshot();

  const attachRun = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        return enterSuite(view, reducedMotion);
      }
    },
    [reducedMotion, view],
  );

  const selectView = (nextView: ConceptViewId) => {
    setConceptView(nextView);
  };

  return (
    <main className={styles.shell}>
      <header className={styles.jobBar}>
        <div className={styles.jobIdentity}>
          <strong>{run.suite.id}</strong>
          <span>target/{view}</span>
        </div>

        <div className={styles.jobMetrics} aria-label="Run status">
          <span>
            cases{' '}
            <strong>
              {run.completed}/{run.cases.length}
            </strong>
          </span>
          <span>
            wall <WallTimer />
          </span>
          <button
            className={styles.replay}
            onClick={() => replaySuite(view, reducedMotion)}
            type="button"
          >
            re-run
          </button>
        </div>
        <div className={styles.progress}>
          <ProgressRule />
        </div>
      </header>

      <nav className={styles.views} aria-label="Evaluation suite">
        {conceptViews.map((entry) => (
          <button
            aria-pressed={entry.id === view}
            data-active={entry.id === view}
            key={entry.id}
            onClick={() => selectView(entry.id)}
            type="button"
          >
            <span>{entry.shortLabel}</span>
            <small>{entry.description}</small>
          </button>
        ))}
      </nav>

      <div
        className={styles.run}
        key={`${view}:${reducedMotion}`}
        ref={attachRun}
      >
        <section className={styles.runIntro}>
          <div>
            <span className={styles.eyebrow}>{run.suite.id}</span>
            <h1>{conceptViews.find((entry) => entry.id === view)?.label}</h1>
          </div>
          <p>{conceptViews.find((entry) => entry.id === view)?.description}</p>
        </section>

        {run.suite.environment ? (
          <Environment environment={run.suite.environment} />
        ) : null}

        <p className={styles.srOnly} aria-live="polite">
          {run.suite.id}: {run.completed} of {run.cases.length} cases passed.
        </p>

        <section className={styles.cases}>
          {run.cases.map((entry, index) => (
            <CaseRow entry={entry} key={entry.id} priority={index === 0} />
          ))}
        </section>
      </div>
    </main>
  );
}
