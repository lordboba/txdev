'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { OrbitalHero } from '@/components/OrbitalHero';
import { ThemeBar } from '@/components/ThemeBar';
import {
  SectionContent,
  SECTION_MODAL_TITLES,
} from '@/components/ContentPanel';
import { Modal } from '@/components/Modal';
import {
  useOrbitalSectionId,
  setOrbitalSectionId,
} from '@/components/runtime/orbitalSectionStore';
import {
  useReducedMotion,
  useThemeMode,
} from '@/components/runtime/themePreferences';
import type { OrbitalSectionId } from '@/lib/orbitalData';
import {
  experiences,
  projects,
  callHighlights,
  callSocialProof,
} from '@/lib/siteData';

const SECTION_IDS: OrbitalSectionId[] = [
  'home',
  'about',
  'projects',
  'blog',
  'contact',
];

function isSectionId(id: string): id is OrbitalSectionId {
  return (SECTION_IDS as string[]).includes(id);
}

const CALENDLY_URL =
  'https://calendly.com/yxiao1717/glitch-dev-team-officer-interview';
const CALENDLY_EMBED_URL = `${CALENDLY_URL}?embed_domain=tylerxiao.com&embed_type=Inline`;

function TimelineModal({ onClose }: { onClose: () => void }) {
  const focusAreas = Array.from(
    new Set(experiences.flatMap((exp) => exp.focus)),
  ).sort();

  return (
    <Modal title="Past Experience" onClose={onClose}>
      <div className="modal-section">
        <div className="modal-chips">
          {focusAreas.map((area) => (
            <span key={area} className="chip">
              {area}
            </span>
          ))}
        </div>
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">Timeline</h3>
        {experiences.map((exp) => (
          <div key={`${exp.company}-${exp.role}`} className="modal-exp-card">
            <div className="modal-exp-meta">
              <span>
                {exp.start} — {exp.end}
              </span>
              <span className="modal-exp-company">{exp.company}</span>
            </div>
            <h4 className="modal-exp-role">{exp.role}</h4>
            <p className="modal-exp-summary">{exp.summary}</p>
            <div className="modal-chips">
              {exp.focus.map((label) => (
                <span key={label} className="chip">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">Projects</h3>
        <div className="modal-project-grid">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.link}
              className="modal-project-card"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="modal-project-role">{project.role}</span>
              <h4 className="modal-project-name">{project.title}</h4>
              <p className="modal-project-desc">{project.description}</p>
              <div className="modal-chips">
                {project.tech.map((tech) => (
                  <span key={tech} className="panel-tech-chip">
                    {tech}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function AllProjectsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="All Projects" onClose={onClose}>
      <div className="modal-project-grid">
        {projects.map((project) => (
          <Link
            key={project.title}
            href={project.link}
            className="modal-project-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="modal-project-img-slot"
              data-project={project.title.toLowerCase().replace(/\s+/g, '-')}
            >
              {project.image ? (
                <Image
                  src={project.image}
                  alt={`${project.title} screenshot`}
                  width={640}
                  height={360}
                  className="modal-project-img"
                />
              ) : (
                <span className="modal-project-img-placeholder">&#9635;</span>
              )}
            </div>
            <span className="modal-project-role">{project.role}</span>
            <h4 className="modal-project-name">{project.title}</h4>
            <p className="modal-project-desc">{project.description}</p>
            <div className="modal-chips">
              {project.tech.map((tech) => (
                <span key={tech} className="panel-tech-chip">
                  {tech}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </Modal>
  );
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Schedule a Call" onClose={onClose}>
      <div className="modal-section">
        <p className="modal-desc">
          15-minute chat to align on goals. We&rsquo;ll cover what you&rsquo;re
          building, how I can help, and immediate next steps.
        </p>
        <div className="modal-action-row">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-btn-primary"
          >
            Open Calendly &#8599;
          </a>
          <a href="mailto:tylerxiao@ucla.edu" className="modal-btn-secondary">
            Email instead
          </a>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-calendly-embed">
          <iframe
            src={CALENDLY_EMBED_URL}
            title="Schedule a call with Tyler Xiao"
            className="modal-calendly-iframe"
            frameBorder="0"
          />
        </div>
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">What to expect</h3>
        <div className="modal-list">
          {callHighlights.map((item) => (
            <div key={item} className="modal-list-item">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="modal-section">
        <h3 className="modal-section-title">Background</h3>
        <div className="modal-list">
          {callSocialProof.map((item) => (
            <div key={item} className="modal-list-item">
              <span className="modal-check">✓</span> {item}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function HomeClient({ visitorCount }: { visitorCount: number | null }) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const selectedSection = useOrbitalSectionId();
  const themeMode = useThemeMode();
  const reducedMotion = useReducedMotion();

  const handleOpenModal = useCallback((id: string) => {
    setActiveModal(id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleSelectSection = useCallback((id: OrbitalSectionId) => {
    setOrbitalSectionId(id);
    setActiveModal(id);
  }, []);

  const activeSectionId =
    activeModal && isSectionId(activeModal) ? activeModal : null;

  return (
    <div className="app-shell">
      <main className="app-main">
        <OrbitalHero
          selectedId={selectedSection}
          onSelect={handleSelectSection}
          themeMode={themeMode}
          visitorCount={visitorCount}
          reducedMotion={reducedMotion}
        />
      </main>
      <div className="home-theme-dock">
        <ThemeBar compact />
      </div>

      {activeSectionId && (
        <Modal
          title={SECTION_MODAL_TITLES[activeSectionId]}
          onClose={handleCloseModal}
        >
          <SectionContent
            sectionId={activeSectionId}
            onOpenModal={handleOpenModal}
          />
        </Modal>
      )}
      {activeModal === 'timeline' && (
        <TimelineModal onClose={handleCloseModal} />
      )}
      {activeModal === 'schedule' && (
        <ScheduleModal onClose={handleCloseModal} />
      )}
      {activeModal === 'all-projects' && (
        <AllProjectsModal onClose={handleCloseModal} />
      )}
    </div>
  );
}
