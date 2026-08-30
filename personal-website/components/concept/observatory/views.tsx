'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { experiments, gitEras, personalNotes } from '../conceptData';
import { featuredProjects } from '../../../content/projectData';
import { companyRun } from '../../../content/experienceData';
import { Readout } from './Readout';
import styles from './Observatory.module.css';

const GITHUB_REPO_URL = 'https://github.com/lordboba/txdev';

export type FocusHandler = (index: number) => void;

type PlateProps = {
  code: string;
  title: string;
  children: ReactNode;
  wide?: boolean;
};

/** A measurement plate: hairline frame, corner ticks, catalogue number. */
function Plate({ code, title, children, wide }: PlateProps) {
  return (
    <section className={wide ? `${styles.plate} ${styles.wide}` : styles.plate}>
      <header className={styles.plateHead}>
        <Readout className={styles.plateCode} value={code} />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function ProfileView() {
  return (
    <>
      <Plate code="01.1" title="Subject" wide>
        <p className={styles.display}>
          TYLER
          <br />
          XIAO
        </p>
        <p className={styles.copy}>
          Computer science at UCLA. Product engineering, agent workflows, and
          the small tools that should already exist. Currently reading between
          Los Angeles, San Francisco, New York, and San Diego.
        </p>
        <div className={styles.actions}>
          <a className={styles.action} href="mailto:tylerxiao@ucla.edu">
            Open channel
          </a>
          <a
            className={styles.actionGhost}
            href="/resume/resume.pdf"
            rel="noreferrer"
            target="_blank"
          >
            Résumé
          </a>
        </div>
      </Plate>

      <Plate code="01.2" title="Station log">
        <table className={styles.table}>
          <tbody>
            {companyRun.map((entry) => (
              <tr key={entry.company}>
                <td className={styles.tableNum}>{entry.period}</td>
                <td>{entry.company}</td>
                <td className={styles.tableDim}>{entry.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Plate>

      <Plate code="01.3" title="Fixed points">
        <ul className={styles.list}>
          {personalNotes.map((note, index) => (
            <li key={note}>
              <span className={styles.tableNum}>
                {String(index + 1).padStart(2, '0')}
              </span>
              {note}
            </li>
          ))}
        </ul>
      </Plate>
    </>
  );
}

export function WorkView({ onFocus }: { onFocus: FocusHandler }) {
  return (
    <>
      {featuredProjects.map((project, index) => (
        <a
          className={styles.capture}
          href={project.link}
          key={project.title}
          onBlur={() => onFocus(-1)}
          onFocus={() => onFocus(index)}
          onPointerEnter={() => onFocus(index)}
          onPointerLeave={() => onFocus(-1)}
          rel="noreferrer"
          target="_blank"
        >
          <div className={styles.captureFrame}>
            <Image
              alt={`${project.title} screenshot`}
              fill
              priority={index === 0}
              sizes="(max-width: 900px) 92vw, 40vw"
              src={project.image}
            />
          </div>
          <div className={styles.captureMeta}>
            <Readout
              className={styles.plateCode}
              value={`02.${index + 1} / DISC ${index + 1}`}
            />
            <h2>{project.title}</h2>
            <p className={styles.copy}>{project.description}</p>
            <span className={styles.tableDim}>
              {project.role} · {project.accent}
            </span>
          </div>
        </a>
      ))}
    </>
  );
}

export function SignalsView() {
  return (
    <>
      <Plate code="03.1" title="Active experiments" wide>
        <ol className={styles.experiments}>
          {experiments.map((experiment) => (
            <li key={experiment.number}>
              <span className={styles.tableNum}>{experiment.number}</span>
              <div>
                <span className={styles.tableDim}>{experiment.status}</span>
                <h3>{experiment.title}</h3>
                <p className={styles.copy}>{experiment.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Plate>

      {/* An honest empty channel. The repository does not record a music
          rotation, so the instrument reports no signal rather than inventing
          one or parking a disabled button here. */}
      <Plate code="03.2" title="Channel 02 — rotation">
        <p className={styles.noSignal}>NO SIGNAL</p>
        <svg
          aria-hidden="true"
          className={styles.trace}
          preserveAspectRatio="none"
          viewBox="0 0 400 40"
        >
          <path d="M0 20 H400" />
        </svg>
        <p className={styles.copy}>
          This channel is wired but unassigned. Nothing in the repository says
          what is in rotation, so the instrument reports the absence instead of
          guessing at taste.
        </p>
      </Plate>
    </>
  );
}

export function HistoryView({ onFocus }: { onFocus: FocusHandler }) {
  const [selected, setSelected] = useState(gitEras.length - 1);
  const era = gitEras[selected];

  return (
    <>
      <Plate code="04.1" title="Revision index">
        <div className={styles.eras} role="listbox" aria-label="Design eras">
          {gitEras.map((entry, index) => (
            <button
              aria-selected={index === selected}
              className={styles.era}
              data-active={index === selected}
              key={entry.commit}
              onBlur={() => onFocus(selected)}
              onClick={() => {
                setSelected(index);
                onFocus(index);
              }}
              onFocus={() => onFocus(index)}
              onPointerEnter={() => onFocus(index)}
              onPointerLeave={() => onFocus(selected)}
              role="option"
              type="button"
            >
              <span className={styles.tableNum}>{entry.date.slice(0, 4)}</span>
              <strong>{entry.label}</strong>
              <span className={styles.tableDim}>{entry.commit}</span>
            </button>
          ))}
        </div>
      </Plate>

      <Plate code={`04.2 / ${era.commit}`} title={era.title} wide>
        <p className={styles.copy}>{era.description}</p>
        <dl className={styles.spec}>
          <div>
            <dt>Visual language</dt>
            <dd>{era.visualLanguage}</dd>
          </div>
          <div>
            <dt>Palette</dt>
            <dd>{era.palette}</dd>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd>{era.date}</dd>
          </div>
        </dl>
        <a
          className={styles.action}
          href={`${GITHUB_REPO_URL}/tree/${era.commit}/personal-website`}
          rel="noreferrer"
          target="_blank"
        >
          Inspect snapshot
        </a>
      </Plate>
    </>
  );
}
