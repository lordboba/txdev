'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
            className="panel-avatar-img"
          />
        </div>
        <div>
          <h3 className="panel-title">Tyler Xiao</h3>
          <p className="panel-subtitle">
            CS @ UCLA &middot; Building agents and backend systems
          </p>
        </div>
      </div>
      <div className="panel-home-links">
        <button
          className="panel-quick-link"
          onClick={() => onOpenModal('timeline')}
        >
          Full experience &rarr;
        </button>
        <button
          className="panel-quick-link"
          onClick={() => onOpenModal('schedule')}
        >
          Schedule a call &rarr;
        </button>
      </div>
    </div>
  );
}

function AboutContent({ onOpenModal }: { onOpenModal: (id: string) => void }) {
  return (
    <div className="panel-about">
      <h3 className="panel-title">About</h3>
      <dl className="panel-facts">
        {quickFacts.map((fact) => (
          <div key={fact.label} className="panel-fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="panel-experience-peek">
        <h4 className="panel-section-label">Recent</h4>
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
            <span className="panel-project-name">{project.title}</span>
            <span className="panel-project-role">{project.role}</span>
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
        Show all {projects.length} projects &rarr;
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
        Schedule a call &rarr;
      </button>
    </div>
  );
}

const PANELS: Record<
  string,
  (props: { onOpenModal: (id: string) => void }) => React.JSX.Element
> = {
  home: HomeContent,
  about: AboutContent,
  projects: ProjectsContent,
  blog: BlogContent,
  contact: ContactContent,
};

export function ContentPanel({
  sectionId,
  onClose,
  onOpenModal,
}: {
  sectionId: string | null;
  onClose: () => void;
  onOpenModal: (id: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sectionId && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [sectionId]);

  if (!sectionId) return null;

  const PanelContent = PANELS[sectionId];
  if (!PanelContent) return null;

  return (
    <div className="content-panel" ref={panelRef}>
      <div className="content-panel-inner">
        <button className="content-panel-close" onClick={onClose}>
          &times;
        </button>
        <PanelContent onOpenModal={onOpenModal} />
      </div>
    </div>
  );
}
