'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { OrbitalSectionId } from '@/lib/orbitalData';
import { projects, type Project } from '@/content/projectData';
import { experienceGroups } from '@/content/experienceData';
import { contactLinks, quickFacts } from '@/lib/siteData';

type PanelProps = { onOpenModal: (id: string) => void };

function ProjectProofCard({
  project,
  index,
  compact = false,
}: {
  project: Project;
  index: number;
  compact?: boolean;
}) {
  return (
    <Link
      href={project.link}
      className="panel-proof-card"
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
            alt={`${project.title} proof`}
            width={compact ? 320 : 640}
            height={compact ? 180 : 360}
            className="panel-project-img"
          />
        ) : (
          <div className="panel-project-proof-fallback">
            <span>{project.proofLabel}</span>
            <strong>{project.tech.slice(0, 2).join(' / ')}</strong>
          </div>
        )}
      </div>
      <div className="panel-proof-meta">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <span>{project.proofLabel}</span>
      </div>
      <h4 className="panel-project-name">{project.title}</h4>
      <span className="panel-project-role">{project.role}</span>
      <p className="panel-project-desc">{project.description}</p>
      <p className="panel-project-proof">{project.proof}</p>
      <div className="panel-project-tech">
        {project.tech.slice(0, compact ? 3 : project.tech.length).map((t) => (
          <span key={t} className="panel-tech-chip">
            {t}
          </span>
        ))}
      </div>
      <span className="panel-link-label">{project.linkLabel} &rarr;</span>
    </Link>
  );
}

function ExperienceGroupRows({ limit }: { limit?: number }) {
  const visibleGroups = experienceGroups
    .map((group) => ({
      ...group,
      items:
        typeof limit === 'number' ? group.items.slice(0, limit) : group.items,
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="panel-timeline-groups">
      {visibleGroups.map((group) => (
        <section key={group.status} className="panel-timeline-group">
          <div className="panel-timeline-head">
            <span>{group.label}</span>
            <span>{String(group.items.length).padStart(2, '0')}</span>
          </div>
          <div className="panel-timeline-list">
            {group.items.map((exp) => (
              <article
                key={`${exp.company}-${exp.role}`}
                className="panel-timeline-item"
              >
                <div className="panel-proof-meta">
                  <span>{exp.period}</span>
                  <span>{exp.company}</span>
                </div>
                <h4 className="panel-exp-role">{exp.role}</h4>
                <p className="panel-exp-summary">{exp.proof}</p>
                <div className="panel-project-tech">
                  {exp.focus.map((label) => (
                    <span key={label} className="panel-tech-chip">
                      {label}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HomeContent({ onOpenModal }: PanelProps) {
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
            CS @ UCLA · Building products, backend systems, and developer tools.
          </p>
          <p
            className="panel-desc"
            style={{ margin: '6px 0 0', fontFamily: 'var(--font-sans)' }}
          >
            This site collects my projects, work history, writing, and current
            experiments.
          </p>
        </div>
      </div>
      <div
        className="panel-section-label"
        style={{ marginTop: 2, marginBottom: 10 }}
      >
        Current Focus
      </div>
      <dl className="panel-facts" aria-label="Core signals">
        <div className="panel-fact">
          <dt>Primary Track</dt>
          <dd>AI workflow tooling · backend systems</dd>
        </div>
        <div className="panel-fact">
          <dt>Mission</dt>
          <dd>Build products that move users from confusion to action</dd>
        </div>
      </dl>
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

function AboutContent({ onOpenModal }: PanelProps) {
  return (
    <div className="panel-about">
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
          Timeline
        </h4>
        <ExperienceGroupRows limit={2} />
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

function ProjectsContent({ onOpenModal }: PanelProps) {
  return (
    <div className="panel-projects">
      <p
        className="panel-desc"
        style={{ marginBottom: 10, fontFamily: 'var(--font-sans)' }}
      >
        A small cluster of shipped systems and prototypes focused on AI,
        products, and infrastructure.
      </p>
      <div className="panel-project-grid">
        {projects.slice(0, 4).map((project, index) => (
          <ProjectProofCard
            key={project.title}
            project={project}
            index={index}
            compact
          />
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

function ContactContent({ onOpenModal }: PanelProps) {
  return (
    <div className="panel-contact">
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
  (props: PanelProps) => React.JSX.Element
> = {
  home: HomeContent,
  about: AboutContent,
  projects: ProjectsContent,
  blog: BlogContent,
  contact: ContactContent,
};

export const SECTION_MODAL_TITLES: Record<OrbitalSectionId, string> = {
  home: 'Home Overview',
  about: 'Profile',
  projects: 'Projects',
  blog: 'Writing',
  contact: 'Contact',
};

export function SectionContent({
  sectionId,
  onOpenModal,
}: {
  sectionId: OrbitalSectionId;
  onOpenModal: (id: string) => void;
}) {
  const Panel = PANELS[sectionId];
  return <Panel onOpenModal={onOpenModal} />;
}
