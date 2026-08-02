'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useSyncExternalStore } from 'react';
import {
  companyRun,
  conceptViews,
  experiments,
  featuredProjects,
  gitEras,
  personalNotes,
  sideProjects,
  type ConceptViewId,
} from '../conceptData';
import { setConceptView, useConceptView } from '../conceptViewStore';
import { useMounted, usePrefersReducedMotion } from '../shared/runtime';
import { BenchScene } from './BenchScene';
import {
  closeBenchGallery,
  openBenchGallery,
  readBenchGallery,
  setBenchGalleryPiece,
  setBenchHover,
  setBenchSelection,
  subscribeBenchGallery,
} from './benchStore';
import styles from './Bench.module.css';

const MOBILE_QUERY = '(max-width: 700px)';

const introHeadings: Record<ConceptViewId, string> = {
  work: 'Hi, I’m Tyler Xiao.',
  profile: 'Here’s me, up close.',
  signals: 'Here’s what I’m testing.',
  history: 'Here’s how this site grew.',
};
/**
 * Employer / school marks from public/logos (see public/logos/manifest.json).
 * Intrinsic sizes derive from each SVG viewBox at a 16px cap height; CSS
 * rescales them, and a grayscale+brightness filter renders them as ink so the
 * project screenshots stay the only color on the page.
 */
const logoMarks: Record<
  string,
  { src: string; width: number; height: number }
> = {
  Snowflake: { src: '/logos/snowflake.svg', width: 67, height: 16 },
  Ramp: { src: '/logos/ramp.svg', width: 59, height: 16 },
  'Scale AI': { src: '/logos/scale-ai.svg', width: 84, height: 16 },
  SafetyKit: { src: '/logos/safetykit.svg', width: 71, height: 16 },
  UCLA: { src: '/logos/ucla.svg', width: 49, height: 16 },
};

/**
 * The company run reads as one sentence here, not as a second logo row. The
 * employer marks are engraved on the signature fixture standing in the 3D work
 * shot, and rendering the same five SVGs again a hundred pixels below it made
 * the DOM the louder of the two — this line is the caption under that object.
 */
const companyCaption = [
  ...companyRun.map((entry) => entry.company),
  'UCLA',
].join(' · ');

const noMobileSubscribe = () => () => {};
let webGLSupport: boolean | undefined;

function subscribeToMobile(onStoreChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

function useMobileLayout() {
  return useSyncExternalStore(
    typeof window === 'undefined' ? noMobileSubscribe : subscribeToMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

function getWebGLSupport() {
  if (webGLSupport !== undefined) {
    return webGLSupport;
  }

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webGLSupport = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webGLSupport = false;
  }

  return webGLSupport;
}

function useWebGLSupport() {
  return useSyncExternalStore(noMobileSubscribe, getWebGLSupport, () => false);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.fieldLabel}>{children}</span>;
}

function useBenchGallery() {
  return useSyncExternalStore(
    subscribeBenchGallery,
    readBenchGallery,
    readBenchGallery,
  );
}

/**
 * The gallery's DOM half. Two jobs the canvas cannot do: give the hang a
 * keyboard-reachable equivalent (a button per piece, driving the same store the
 * raycast drives), and carry the one thing a rendered placard must not — a real
 * anchor to the real URL.
 */
function GalleryDetails({ piece }: { piece: number }) {
  const focused = piece >= 0 ? sideProjects[piece] : null;

  return (
    <div className={`${styles.details} ${styles.galleryDetails}`}>
      <div className={styles.galleryBar}>
        <button
          className={styles.galleryBack}
          onClick={closeBenchGallery}
          type="button"
        >
          <span aria-hidden="true">←</span> Back to the bench
        </button>
        <ul className={styles.galleryIndex}>
          {sideProjects.map((entry, index) => (
            <li key={entry.title}>
              <button
                aria-pressed={index === piece}
                data-active={index === piece}
                onClick={() => setBenchGalleryPiece(index)}
                type="button"
              >
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
        <span className={styles.galleryHint}>Esc to exit</span>
      </div>

      {focused ? (
        /*
         * The wall label beside the piece already states role, title, tech and
         * host. This is the other half of the record — the sentence and the
         * live anchor — not a second printing of it.
         */
        <div className={styles.galleryPlacard}>
          <p>
            <FieldLabel>{focused.title}</FieldLabel>
            {focused.description}
          </p>
          <a href={focused.link} rel="noreferrer" target="_blank">
            {focused.linkLabel} <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : (
        <p className={styles.galleryPrompt}>Pick a piece to read its label.</p>
      )}
    </div>
  );
}

function WorkDetails() {
  const gallery = useBenchGallery();

  if (gallery.open) {
    return <GalleryDetails piece={gallery.piece} />;
  }

  return (
    <div className={`${styles.details} ${styles.workDetails}`}>
      {featuredProjects.map((project, index) => (
        <a
          className={styles.projectPlate}
          href={project.link}
          key={project.title}
          onBlur={() => setBenchHover('work', -1)}
          onClick={() => setBenchSelection('work', index)}
          onFocus={() => setBenchHover('work', index)}
          onPointerEnter={() => setBenchHover('work', index)}
          onPointerLeave={() => setBenchHover('work', -1)}
          rel="noreferrer"
          target="_blank"
        >
          <div className={styles.plateHeading}>
            <FieldLabel>{project.role}</FieldLabel>
            <span aria-hidden="true">↗</span>
          </div>
          <h2>{project.title}</h2>
          <p>{project.description}</p>
          <strong>{project.accent}</strong>
        </a>
      ))}
      <div className={styles.credLine}>
        {/*
         * The tablet on the bench is the primary control; this is its
         * keyboard-reachable twin, and it lights the same hover slot the
         * raycast does so the two surfaces agree.
         */}
        <button
          className={styles.galleryCue}
          onBlur={() => setBenchHover('work', -1)}
          onClick={openBenchGallery}
          onFocus={() => setBenchHover('work', featuredProjects.length)}
          onPointerEnter={() => setBenchHover('work', featuredProjects.length)}
          onPointerLeave={() => setBenchHover('work', -1)}
          type="button"
        >
          <FieldLabel>On the tablet</FieldLabel>
          <span>
            {sideProjects.length} side projects{' '}
            <span aria-hidden="true">→</span>
          </span>
        </button>
        <p className={styles.credCaption}>
          <FieldLabel>Signed</FieldLabel>
          {companyCaption}
        </p>
      </div>
    </div>
  );
}

function ProfileDetails() {
  return (
    <div className={`${styles.details} ${styles.profileDetails}`}>
      <section className={styles.notePlate}>
        <FieldLabel>Card fields</FieldLabel>
        <ul className={styles.notes}>
          {personalNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className={styles.companyPlate}>
        <FieldLabel>Company run</FieldLabel>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Period</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {companyRun.map((entry) => {
              const mark = logoMarks[entry.company];
              return (
                <tr key={entry.company}>
                  <td>
                    <span className={styles.companyCell}>
                      {mark ? (
                        <Image
                          alt={entry.company}
                          className={styles.tableMark}
                          height={mark.height}
                          src={mark.src}
                          width={mark.width}
                        />
                      ) : null}
                      {entry.company}
                    </span>
                  </td>
                  <td>{entry.period}</td>
                  <td>{entry.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SignalsDetails() {
  return (
    <ol className={`${styles.details} ${styles.signalDetails}`}>
      {experiments.map((experiment, index) => (
        <li
          key={experiment.number}
          onPointerEnter={() => setBenchHover('signals', index)}
          onPointerLeave={() => setBenchHover('signals', -1)}
        >
          <div className={styles.plateHeading}>
            <FieldLabel>Experiment {experiment.number}</FieldLabel>
            <strong>{experiment.status}</strong>
          </div>
          <h2>{experiment.title}</h2>
          <p>{experiment.description}</p>
        </li>
      ))}
    </ol>
  );
}

function HistoryDetails() {
  return (
    <ol className={`${styles.details} ${styles.historyDetails}`}>
      {gitEras.map((era, index) => (
        <li key={era.commit}>
          <button
            onBlur={() => setBenchHover('history', -1)}
            onClick={() => setBenchSelection('history', index)}
            onFocus={() => setBenchHover('history', index)}
            onPointerEnter={() => setBenchHover('history', index)}
            onPointerLeave={() => setBenchHover('history', -1)}
            type="button"
          >
            <span className={styles.plateHeading}>
              <FieldLabel>{era.date}</FieldLabel>
              <span>{era.commit}</span>
            </span>
            <strong>{era.label}</strong>
            <span>{era.visualLanguage}</span>
            <span>{era.palette}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

type BenchProps = {
  /** Replaces the "Product study" context label in the header. */
  actions?: React.ReactNode;
  initialView?: ConceptViewId;
  visitorCount?: number | null;
};

export function Bench({ actions, initialView, visitorCount }: BenchProps = {}) {
  const view = useConceptView(initialView);
  const gallery = useBenchGallery();
  const mounted = useMounted();
  const webGLSupported = useWebGLSupport();
  const reducedMotion = usePrefersReducedMotion();
  const mobile = useMobileLayout();
  const activeView =
    conceptViews.find((entry) => entry.id === view) ?? conceptViews[0];
  const inGallery = view === 'work' && gallery.open;

  const selectView = useCallback((nextView: ConceptViewId) => {
    closeBenchGallery();
    setConceptView(nextView);
    setBenchHover(nextView, -1);
  }, []);

  const handleNavKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const activeIndex = conceptViews.findIndex((entry) => entry.id === view);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex =
      (activeIndex + offset + conceptViews.length) % conceptViews.length;
    selectView(conceptViews[nextIndex].id);
  };

  return (
    <main className={styles.shell} data-view={view}>
      <header
        className={styles.header}
        data-has-actions={actions ? 'true' : undefined}
      >
        <Link className={styles.wordmark} href="/">
          Tyler Xiao
        </Link>
        <nav
          aria-label="Bench view"
          className={styles.nav}
          onKeyDown={handleNavKey}
        >
          {conceptViews.map((entry) => (
            <button
              aria-pressed={entry.id === view}
              data-active={entry.id === view}
              key={entry.id}
              onClick={() => selectView(entry.id)}
              type="button"
            >
              {entry.shortLabel}
            </button>
          ))}
        </nav>
        {actions ?? <span className={styles.context}>Product study</span>}
      </header>

      <section
        aria-labelledby="bench-title"
        className={styles.intro}
        data-compact={inGallery ? 'true' : undefined}
      >
        <FieldLabel>
          {inGallery ? 'Side projects' : activeView.label}
        </FieldLabel>
        <h1 id="bench-title">
          {inGallery ? 'The rest of the shelf.' : introHeadings[activeView.id]}
        </h1>
        <p>
          {inGallery
            ? 'Everything I have built that is not one of the four shipped products — benchmarks, bots, games, and tools, each with its repo or live link.'
            : activeView.description}
        </p>
      </section>

      <div className={styles.sceneStage}>
        {mounted && webGLSupported ? (
          <BenchScene
            className={styles.canvas}
            initialView={initialView}
            mobile={mobile}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </div>

      {view === 'work' ? <WorkDetails /> : null}
      {view === 'profile' ? <ProfileDetails /> : null}
      {view === 'signals' ? <SignalsDetails /> : null}
      {view === 'history' ? <HistoryDetails /> : null}

      <footer className={styles.footer}>
        <span>My studio bench</span>
        <div className={styles.footerMeta}>
          {typeof visitorCount === 'number' ? (
            <span className={styles.visitorMetric}>
              <span>Visitors</span>
              <span className={styles.visitorValue}>
                {visitorCount.toLocaleString('en-US')}
              </span>
            </span>
          ) : null}
          <span>{activeView.shortLabel}</span>
        </div>
      </footer>
    </main>
  );
}
