'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useSyncExternalStore } from 'react';
import {
  companyTags,
  conceptViews,
  experimentNotes,
  experiments,
  featuredProjects,
  notesLabel,
  sideProjects,
  type ConceptViewId,
} from '../conceptData';
import { setConceptView, useConceptView } from '../conceptViewStore';
import { useMounted, usePrefersReducedMotion } from '../shared/runtime';
import { BenchScene, preloadHistoryShots } from './BenchScene';
import {
  clearBenchHistorySelection,
  clearBenchSignalSelection,
  clearBenchTagSelection,
  closeBenchGallery,
  closeBenchHistoryLightbox,
  openBenchGallery,
  openBenchHistoryLightbox,
  readBenchGallery,
  readBenchHistory,
  readBenchSignals,
  readBenchTags,
  setBenchGalleryPiece,
  setBenchHistorySelection,
  setBenchHover,
  setBenchSelection,
  setBenchSignalHover,
  setBenchSignalSelection,
  setBenchTagHover,
  setBenchTagSelection,
  subscribeBenchGallery,
  subscribeBenchHistory,
  subscribeBenchSignals,
  subscribeBenchTags,
} from './benchStore';
import { historyEras } from './historyEras';
import styles from './Bench.module.css';

const MOBILE_QUERY = '(max-width: 700px)';

const introHeadings: Record<ConceptViewId, string> = {
  work: 'Hi, I’m Tyler Xiao.',
  profile: 'Here’s me, up close.',
  signals: 'Here’s what I’m testing.',
  history: 'Here’s how this site grew.',
};
/** Mobile fallback for the tag rail: the same five names, as one line. */
const companyCaption = companyTags.map((tag) => tag.mark).join(' · ');

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

function useBenchTags() {
  return useSyncExternalStore(subscribeBenchTags, readBenchTags, readBenchTags);
}

function useBenchHistory() {
  return useSyncExternalStore(
    subscribeBenchHistory,
    readBenchHistory,
    readBenchHistory,
  );
}

function useBenchSignals() {
  return useSyncExternalStore(
    subscribeBenchSignals,
    readBenchSignals,
    readBenchSignals,
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

/**
 * The tags' keyboard-reachable twin. Names only, no marks: the five logos are
 * milled into the hanging plates in the 3D shot, and printing the same five
 * SVGs again a hundred pixels below them is exactly what made the DOM the
 * louder of the two surfaces last time. Hover here lights the same tag the
 * raycast does, so the two agree about what is live.
 */
function TagIndex({ selected }: { selected: number }) {
  return (
    <ul className={styles.tagIndex}>
      {companyTags.map((tag, index) => (
        <li key={tag.mark}>
          <button
            aria-pressed={index === selected}
            data-active={index === selected}
            onBlur={() => setBenchTagHover(-1)}
            onClick={() => setBenchTagSelection(index)}
            onFocus={() => setBenchTagHover(index)}
            onPointerEnter={() => setBenchTagHover(index)}
            onPointerLeave={() => setBenchTagHover(-1)}
            type="button"
          >
            {tag.mark}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The opened tag. Everything here is a field off the joined record in
 * `companyTags`, which is itself a join onto lib/siteData — the panel has no
 * copy of its own to get wrong. Same exit contract as the gallery: a back
 * control, Escape, or a click on empty bench.
 */
function TagDetails({ selected }: { selected: number }) {
  const tag = companyTags[selected];

  return (
    <div className={`${styles.details} ${styles.tagDetails}`}>
      <div className={styles.galleryBar}>
        <button
          className={styles.galleryBack}
          onClick={clearBenchTagSelection}
          type="button"
        >
          <span aria-hidden="true">←</span> Back to the bench
        </button>
        <TagIndex selected={selected} />
        <span className={styles.galleryHint}>Esc to exit</span>
      </div>

      <div className={styles.tagRecord}>
        <div className={styles.tagHeading}>
          <FieldLabel>{tag.statusLabel}</FieldLabel>
          <h2>{tag.org}</h2>
          <p>{tag.summary}</p>
        </div>

        <dl className={styles.tagFields}>
          <div>
            <dt>Role</dt>
            <dd>{tag.role}</dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd>{tag.period}</dd>
          </div>
          <div>
            <dt>Focus</dt>
            <dd>{tag.focus.join(' · ')}</dd>
          </div>
          {tag.detail ? (
            <div>
              <dt>On the run</dt>
              <dd>{tag.detail}</dd>
            </div>
          ) : null}
        </dl>

        <p className={styles.tagProof}>
          <FieldLabel>Proof</FieldLabel>
          {tag.proof}
        </p>
      </div>
    </div>
  );
}

function WorkDetails({ mobile }: { mobile: boolean }) {
  const gallery = useBenchGallery();
  const tags = useBenchTags();

  if (gallery.open) {
    return <GalleryDetails piece={gallery.piece} />;
  }

  if (!mobile && tags.selected >= 0) {
    return <TagDetails selected={tags.selected} />;
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
        <div className={styles.signRail}>
          <FieldLabel>Signed</FieldLabel>
          {/*
           * The rack is not in the mobile scene, so its DOM twin stops being a
           * control there and goes back to being a caption. A button whose
           * only job is to focus a lens on an object that is not in the frame
           * is a dead end, and the row's whole point is that the two surfaces
           * agree.
           */}
          {mobile ? (
            <p className={styles.signCaption}>{companyCaption}</p>
          ) : (
            <TagIndex selected={-1} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The one thing the engraved badge cannot do: go somewhere. Every field the
 * profile view used to repeat down here — card fields, the company run — is
 * already on the badge or on the work view's signature plate, so the DOM
 * keeps only real destinations. All five are live routes or profiles, from
 * `app/` and `lib/siteData.ts` — nothing invented.
 */
const profileLinks: { label: string; href: string; external?: true }[] = [
  { label: 'Resume', href: '/resume/resume.pdf', external: true },
  { label: 'GitHub', href: 'https://github.com/lordboba', external: true },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/tyler-xiao',
    external: true,
  },
  { label: 'Schedule a call', href: '/schedule-a-call' },
  { label: 'Email', href: 'mailto:tylerxiao@ucla.edu' },
];

function ProfileDetails() {
  return (
    <div className={`${styles.details} ${styles.profileDetails}`}>
      <nav aria-label="Profile links" className={styles.linkPlate}>
        <FieldLabel>Off the card</FieldLabel>
        <ul className={styles.linkRow}>
          {profileLinks.map((entry) => (
            <li key={entry.label}>
              {entry.href.startsWith('/') && !entry.external ? (
                <Link href={entry.href}>{entry.label}</Link>
              ) : (
                <a
                  href={entry.href}
                  rel={entry.external ? 'noreferrer' : undefined}
                  target={entry.external ? '_blank' : undefined}
                >
                  {entry.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * The blanks' keyboard-reachable twin, and the surface that has to agree with
 * the raycast: hovering a plate here lights the same fixture on the bench, and
 * clicking either one opens the same record.
 */
function SignalIndex({ selected }: { selected: number }) {
  return (
    <ul className={styles.galleryIndex}>
      {experiments.map((experiment, index) => (
        <li key={experiment.number}>
          <button
            aria-pressed={index === selected}
            data-active={index === selected}
            onBlur={() => setBenchSignalHover(-1)}
            onClick={() => setBenchSignalSelection(index)}
            onFocus={() => setBenchSignalHover(index)}
            onPointerEnter={() => setBenchSignalHover(index)}
            onPointerLeave={() => setBenchSignalHover(-1)}
            type="button"
          >
            {experiment.status}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The opened signal. Every word in here comes out of the TEMPLATE COPY block
 * in conceptData, and the panel says so: `notesLabel` is printed beside the
 * heading in the same micro-label style the field names use, because this copy
 * is a draft and the page is not allowed to imply otherwise.
 *
 * Same exit contract as the gallery and the tag record: a back control,
 * Escape, or a click on empty bench.
 */
function SignalRecord({ selected }: { selected: number }) {
  const experiment = experiments[selected];
  const note =
    experimentNotes.find((entry) => entry.number === experiment.number) ?? null;

  return (
    <div className={`${styles.details} ${styles.signalRecord}`}>
      <div className={styles.galleryBar}>
        <button
          className={styles.galleryBack}
          onClick={clearBenchSignalSelection}
          type="button"
        >
          <span aria-hidden="true">←</span> Back to the bench
        </button>
        <SignalIndex selected={selected} />
        <span className={styles.galleryHint}>Esc to exit</span>
      </div>

      <div className={styles.signalNote}>
        <div className={styles.signalHeading}>
          <span className={styles.signalMarker}>
            <FieldLabel>Experiment {experiment.number}</FieldLabel>
            <FieldLabel>{notesLabel}</FieldLabel>
          </span>
          <h2>{experiment.title}</h2>
          {note ? <p>{note.question}</p> : <p>{experiment.description}</p>}
        </div>

        {note ? (
          <>
            <div className={styles.signalColumn}>
              <FieldLabel>In rotation</FieldLabel>
              <ul>
                {note.running.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className={styles.signalColumn}>
              <FieldLabel>Already on the bench</FieldLabel>
              <ul>
                {note.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <dl className={styles.signalFoot}>
              <div>
                <dt>Reading for</dt>
                <dd>{note.readout}</dd>
              </div>
              <div>
                <dt>Next</dt>
                <dd>{note.next}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>
    </div>
  );
}

/*
 * The record opens on every width, unlike the tag record. The tags degrade on
 * mobile because the rack is not in the mobile scene at all, so its DOM twin
 * would be a control pointing at nothing; the three fixtures *are* mounted on
 * mobile. Only the camera stands down there — see the scene's `focusedSignal`.
 */
function SignalsDetails() {
  const signals = useBenchSignals();

  if (signals.selected >= 0) {
    return <SignalRecord selected={signals.selected} />;
  }

  return (
    <ol className={`${styles.details} ${styles.signalDetails}`}>
      {experiments.map((experiment, index) => (
        <li key={experiment.number}>
          {/*
           * A button, not a plate with a hover handler. The fixture on the
           * bench is clickable, so its twin down here has to be reachable
           * without a pointer — and it opens the same record the raycast does.
           */}
          <button
            aria-pressed={index === signals.selected}
            onBlur={() => setBenchSignalHover(-1)}
            onClick={() => setBenchSignalSelection(index)}
            onFocus={() => setBenchSignalHover(index)}
            onPointerEnter={() => setBenchSignalHover(index)}
            onPointerLeave={() => setBenchSignalHover(-1)}
            type="button"
          >
            <span className={styles.plateHeading}>
              <FieldLabel>Experiment {experiment.number}</FieldLabel>
              <strong>{experiment.status}</strong>
            </span>
            <h2>{experiment.title}</h2>
            <p>{experiment.description}</p>
            <span className={styles.signalCue}>
              Read the notes <span aria-hidden="true">→</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** The era run's keyboard-reachable twin, same contract as SignalIndex. */
function EraIndex({ selected }: { selected: number }) {
  return (
    <ul className={styles.galleryIndex}>
      {historyEras.map((era, index) => (
        <li key={era.commit}>
          <button
            aria-pressed={index === selected}
            data-active={index === selected}
            onBlur={() => setBenchHover('history', -1)}
            onClick={() => setBenchHistorySelection(index)}
            onFocus={() => setBenchHover('history', index)}
            onPointerEnter={() => setBenchHover('history', index)}
            onPointerLeave={() => setBenchHover('history', -1)}
            type="button"
          >
            {era.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The opened era. The card on the bench carries the capture at card size; this
 * is the record behind it — the commit it came from, what it was, and a link to
 * that commit on the real remote when the repository has one. Nothing here is
 * written by hand for the provisional entry, and the panel says so.
 */
function EraRecord({ selected }: { selected: number }) {
  const era = historyEras[selected];

  return (
    <div className={`${styles.details} ${styles.eraRecord}`}>
      <div className={styles.galleryBar}>
        <button
          className={styles.galleryBack}
          onClick={clearBenchHistorySelection}
          type="button"
        >
          <span aria-hidden="true">←</span> Back to the run
        </button>
        <EraIndex selected={selected} />
        <span className={styles.galleryHint}>Esc to exit</span>
      </div>

      <div className={styles.eraPanel}>
        {era.shot ? (
          /*
           * A real capture, and clickable: the band is 200px tall and a
           * homepage does not read at 150px, so the full-size view is one
           * gesture away rather than absent.
           */
          <button
            className={styles.eraShot}
            onClick={openBenchHistoryLightbox}
            type="button"
          >
            <Image
              alt={`The site at commit ${era.commit}`}
              height={720}
              sizes="(max-width: 900px) 90vw, 300px"
              src={era.shot}
              width={1280}
            />
            <span>
              Full size <span aria-hidden="true">⤢</span>
            </span>
          </button>
        ) : (
          <p className={styles.eraNoShot}>
            <FieldLabel>No capture</FieldLabel>
            This state has not been photographed yet.
          </p>
        )}

        <div className={styles.eraHeading}>
          <span className={styles.eraMarker}>
            <FieldLabel>{era.date}</FieldLabel>
            {era.provisional ? <FieldLabel>Provisional</FieldLabel> : null}
          </span>
          <h2>{era.label}</h2>
          <p>{era.description}</p>
        </div>

        <dl className={styles.eraFields}>
          <div>
            <dt>Commit</dt>
            <dd>
              {era.commitUrl ? (
                <a href={era.commitUrl} rel="noreferrer" target="_blank">
                  {era.commit} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                era.commit
              )}
            </dd>
          </div>
          <div>
            <dt>Visual language</dt>
            <dd>{era.visualLanguage}</dd>
          </div>
          <div>
            <dt>Palette</dt>
            <dd>{era.palette}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/**
 * The capture at full size. A plain overlay rather than a dialog element: it
 * carries one image and one control, closes on Escape through the same store
 * ladder every other sub-view uses, and closes on a click anywhere off the
 * picture.
 */
function EraLightbox({ selected }: { selected: number }) {
  const era = historyEras[selected];

  if (!era.shot) {
    return null;
  }

  return (
    <div
      className={styles.lightbox}
      onClick={closeBenchHistoryLightbox}
      role="presentation"
    >
      <figure>
        <Image
          alt={`The site at commit ${era.commit}, full size`}
          height={720}
          sizes="90vw"
          src={era.shot}
          width={1280}
        />
        <figcaption>
          <span>
            <FieldLabel>{era.date}</FieldLabel>
            {era.label} · {era.commit}
          </span>
          <button onClick={closeBenchHistoryLightbox} type="button">
            Close <span aria-hidden="true">✕</span>
          </button>
        </figcaption>
      </figure>
    </div>
  );
}

function HistoryDetails({ selected }: { selected: number }) {
  if (selected >= 0) {
    return <EraRecord selected={selected} />;
  }

  return (
    <ol
      className={`${styles.details} ${styles.historyDetails}`}
      style={{ '--era-count': historyEras.length } as React.CSSProperties}
    >
      {historyEras.map((era, index) => (
        <li key={era.commit}>
          <button
            onBlur={() => setBenchHover('history', -1)}
            onClick={() => setBenchHistorySelection(index)}
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
            <span className={styles.signalCue}>
              Open the capture <span aria-hidden="true">→</span>
            </span>
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
  const tags = useBenchTags();
  const signals = useBenchSignals();
  const history = useBenchHistory();
  const mounted = useMounted();
  const webGLSupported = useWebGLSupport();
  const reducedMotion = usePrefersReducedMotion();
  const mobile = useMobileLayout();
  const activeView =
    conceptViews.find((entry) => entry.id === view) ?? conceptViews[0];
  const inGallery = view === 'work' && gallery.open;
  const inTagRecord = view === 'work' && !gallery.open && tags.selected >= 0;
  const inSignalRecord = view === 'signals' && signals.selected >= 0;
  const inEraRecord = view === 'history' && history.selected >= 0;

  const selectView = useCallback((nextView: ConceptViewId) => {
    closeBenchGallery();
    clearBenchTagSelection();
    clearBenchSignalSelection();
    clearBenchHistorySelection();
    setBenchTagHover(-1);
    setBenchSignalHover(-1);

    /*
     * Warm the era captures on the gesture that asks for them, the same way
     * the tablet warms the hang: the camera transit across the run is ~600ms
     * and the decodes land inside it, so the cards arrive already printed.
     */
    if (nextView === 'history') {
      preloadHistoryShots();
    }

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
        data-compact={
          inGallery || inTagRecord || inSignalRecord || inEraRecord
            ? 'true'
            : undefined
        }
      >
        {/*
         * Both sub-views step the display heading down to a caption for the
         * same reason: the 4.35rem type owns a 26rem block in the top-left, and
         * that block is where the hang's first exhibit and the rail's first tag
         * both land. It is still the page's h1, just no longer the loudest
         * object in the frame.
         */}
        <FieldLabel>
          {inGallery
            ? 'Side projects'
            : inTagRecord
              ? 'Signed'
              : inSignalRecord
                ? `Experiment ${experiments[signals.selected].number}`
                : inEraRecord
                  ? historyEras[history.selected].date
                  : activeView.label}
        </FieldLabel>
        <h1 id="bench-title">
          {inGallery
            ? 'The rest of the shelf.'
            : inTagRecord
              ? 'Where the work was done.'
              : inSignalRecord
                ? 'Here are the working notes.'
                : inEraRecord
                  ? 'Here is what it looked like.'
                  : introHeadings[activeView.id]}
        </h1>
        <p>
          {inGallery
            ? 'Everything I have built that is not one of the four shipped products — benchmarks, bots, games, and tools, each with its repo or live link.'
            : inTagRecord
              ? 'Five tags on one rail: the run in the order it happened, and the credential at the end. The record for each is underneath.'
              : inSignalRecord
                ? 'One of the three open questions, opened up. These are drafts I am still editing, not conclusions.'
                : inEraRecord
                  ? 'A real capture of this site at that commit, and a link to the commit.'
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

      {view === 'work' ? <WorkDetails mobile={mobile} /> : null}
      {view === 'profile' ? <ProfileDetails /> : null}
      {view === 'signals' ? <SignalsDetails /> : null}
      {view === 'history' ? (
        <HistoryDetails selected={history.selected} />
      ) : null}
      {inEraRecord && history.lightbox ? (
        <EraLightbox selected={history.selected} />
      ) : null}

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
