'use client';

import {
  useReducer,
  useRef,
  type TransitionEvent as ReactTransitionEvent,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OrbitalSectionId } from '@/lib/orbitalData';
import {
  quickFacts,
  projects,
  experiences,
  contactLinks,
} from '@/lib/siteData';

function HomeContent({ onOpenModal }: { onOpenModal: (id: string) => void }) {
  return (
    <div className="panel-home">
      <div className="panel-home-intro">
        <div className="panel-home-avatar">
          <Image
            src="/pfp.JPG"
            alt="Tyler Xiao"
            width={80}
            height={80}
            loading="eager"
            className="panel-avatar-img"
          />
        </div>
        <div>
          <h3 className="panel-title" style={{ marginBottom: 6 }}>
            Tyler Xiao
          </h3>
          <p className="panel-subtitle">
            CS @ UCLA · Building agentic systems and shipping reliable
            infrastructure.
          </p>
          <p
            className="panel-desc"
            style={{ margin: '6px 0 0', fontFamily: 'var(--font-sans)' }}
          >
            This portfolio is a single operating room for selected work: ideas,
            execution notes, and the most recent builds worth keeping visible.
          </p>
        </div>
      </div>
      <div
        className="panel-section-label"
        style={{ marginTop: 2, marginBottom: 10 }}
      >
        Current Focus
      </div>
      <div className="panel-facts" aria-label="Core signals">
        <div className="panel-fact">
          <dt>Primary Track</dt>
          <dd>AI workflow tooling · backend systems</dd>
        </div>
        <div className="panel-fact">
          <dt>Mission</dt>
          <dd>Build products that move users from confusion to action</dd>
        </div>
      </div>
      <div className="panel-home-links">
        <button
          className="panel-quick-link"
          onClick={() => onOpenModal('timeline')}
        >
          Full timeline &rarr;
        </button>
        <button
          className="panel-quick-link"
          onClick={() => onOpenModal('schedule')}
        >
          Open scheduling channel &rarr;
        </button>
      </div>
    </div>
  );
}

function AboutContent({ onOpenModal }: { onOpenModal: (id: string) => void }) {
  return (
    <div className="panel-about">
      <h3 className="panel-title">About</h3>
      <p
        className="panel-desc"
        style={{ marginBottom: 10, fontFamily: 'var(--font-sans)' }}
      >
        I care about systems that are technically rigorous and easy to reason
        about. The goal is to make complex work feel practical and maintainable.
      </p>
      <dl className="panel-facts">
        {quickFacts.map((fact) => (
          <div key={fact.label} className="panel-fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="panel-experience-peek">
        <h4
          className="panel-section-label"
          style={{ marginTop: 14, marginBottom: 8 }}
        >
          Recent Assignments
        </h4>
        {experiences.slice(0, 2).map((exp) => (
          <div key={`${exp.company}-${exp.role}`} className="panel-exp-item">
            <span className="panel-exp-role">{exp.role}</span>
            <span className="panel-exp-co">{exp.company}</span>
          </div>
        ))}
        <button
          className="panel-more-link"
          onClick={() => onOpenModal('timeline')}
        >
          View full timeline &rarr;
        </button>
      </div>
    </div>
  );
}

function ProjectsContent({
  onOpenModal,
}: {
  onOpenModal: (id: string) => void;
}) {
  return (
    <div className="panel-projects">
      <h3 className="panel-title">Projects</h3>
      <p
        className="panel-desc"
        style={{ marginBottom: 10, fontFamily: 'var(--font-sans)' }}
      >
        A small cluster of shipped systems and prototypes focused on AI,
        products, and infrastructure.
      </p>
      <div className="panel-project-grid">
        {projects.slice(0, 4).map((project) => (
          <Link
            key={project.title}
            href={project.link}
            className="panel-project-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="panel-project-img-slot"
              data-project={project.title.toLowerCase().replace(/\s+/g, '-')}
            >
              {project.image ? (
                <Image
                  src={project.image}
                  alt={`${project.title} screenshot`}
                  width={320}
                  height={180}
                  className="panel-project-img"
                />
              ) : (
                <span className="panel-project-img-placeholder">&#9635;</span>
              )}
            </div>
            <h4 className="panel-project-name">{project.title}</h4>
            <span className="panel-project-role">{project.role}</span>
            <p
              className="panel-project-desc"
              style={{
                margin: 0,
                fontSize: '11px',
                lineHeight: 1.45,
                color: 'var(--muted)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {project.description}
            </p>
            <div className="panel-project-tech">
              {project.tech.slice(0, 3).map((t) => (
                <span key={t} className="panel-tech-chip">
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
      <button
        className="panel-expand-btn"
        onClick={() => onOpenModal('all-projects')}
      >
        <span>Browse all</span>
        <span>{projects.length}</span>
        <span>projects</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </div>
  );
}

function BlogContent() {
  return (
    <div className="panel-blog">
      <h3 className="panel-title">Blog</h3>
      <p className="panel-desc">
        Technical notes on product engineering, AI workflows, and design
        systems.
      </p>
      <p className="panel-section-label" style={{ marginTop: 4 }}>
        Current Reading Lane
      </p>
      <Link href="/blog" className="panel-cta">
        Read all posts &rarr;
      </Link>
    </div>
  );
}

function ContactContent({
  onOpenModal,
}: {
  onOpenModal: (id: string) => void;
}) {
  return (
    <div className="panel-contact">
      <h3 className="panel-title">Contact</h3>
      <p
        className="panel-desc"
        style={{ marginBottom: 8, fontFamily: 'var(--font-sans)' }}
      >
        Reach out directly for collaborations, consulting windows, or technical
        reviews.
      </p>
      <div className="panel-contact-links">
        {contactLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="panel-contact-item"
            target={link.href.startsWith('http') ? '_blank' : undefined}
            rel={
              link.href.startsWith('http') ? 'noopener noreferrer' : undefined
            }
          >
            {link.label}
            {link.href.startsWith('http') && <span> &#8599;</span>}
          </Link>
        ))}
      </div>
      <button className="panel-cta" onClick={() => onOpenModal('schedule')}>
        Open schedule workflow &rarr;
      </button>
    </div>
  );
}

const PANELS: Record<
  OrbitalSectionId,
  (props: { onOpenModal: (id: string) => void }) => React.JSX.Element
> = {
  home: HomeContent,
  about: AboutContent,
  projects: ProjectsContent,
  blog: BlogContent,
  contact: ContactContent,
};

type PanelTransitionState = {
  displayed: OrbitalSectionId;
  phase: 'in' | 'out';
  pending: OrbitalSectionId | null;
  requested: OrbitalSectionId;
};

type PanelAction =
  | { type: 'request'; sectionId: OrbitalSectionId }
  | { type: 'finish-transition' };

function reducePanelState(
  state: PanelTransitionState,
  action: PanelAction,
): PanelTransitionState {
  if (action.type === 'request') {
    if (action.sectionId === state.requested) {
      return state;
    }

    if (action.sectionId === state.displayed) {
      return {
        displayed: state.displayed,
        phase: 'in',
        pending: null,
        requested: action.sectionId,
      };
    }

    return {
      displayed: state.displayed,
      phase: 'out',
      pending: action.sectionId,
      requested: action.sectionId,
    };
  }

  if (state.phase !== 'out' || state.pending === null) {
    return state;
  }

  return {
    displayed: state.pending,
    phase: 'in',
    pending: null,
    requested: state.pending,
  };
}

export function ContentPanel({
  sectionId,
  onOpenModal,
}: {
  sectionId: OrbitalSectionId;
  onOpenModal: (id: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [transitionState, dispatch] = useReducer(reducePanelState, {
    displayed: sectionId,
    phase: 'in',
    pending: null,
    requested: sectionId,
  });

  if (transitionState.requested !== sectionId) {
    dispatch({ type: 'request', sectionId });
  }

  const PanelContent = PANELS[transitionState.displayed];

  const resetScrollPosition = (node: HTMLDivElement | null) => {
    if (node && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  };

  const handleTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'opacity' ||
      transitionState.phase !== 'out'
    ) {
      return;
    }

    dispatch({ type: 'finish-transition' });
  };

  return (
    <div className="content-panel" ref={panelRef}>
      <div
        key={transitionState.displayed}
        ref={resetScrollPosition}
        className={`content-panel-inner panel-phase-${transitionState.phase}`}
        onTransitionEnd={handleTransitionEnd}
      >
        <PanelContent onOpenModal={onOpenModal} />
      </div>
    </div>
  );
}
