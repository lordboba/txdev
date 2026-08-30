'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  conceptViews,
  experiments,
  gitEras,
  personalNotes,
} from '../conceptData';
import { featuredProjects } from '../../../content/projectData';
import { companyRun } from '../../../content/experienceData';
import { setConceptView, useConceptView } from '../conceptViewStore';
import { useMounted, usePrefersReducedMotion } from '../shared/runtime';
import { PressObject } from './PressObject';
import styles from './Press.module.css';

const GITHUB_REPO_URL = 'https://github.com/lordboba/txdev';

export function Press() {
  const view = useConceptView();
  const reducedMotion = usePrefersReducedMotion();
  const mounted = useMounted();
  const [hovered, setHovered] = useState(false);
  const [era, setEra] = useState(gitEras.length - 1);

  return (
    <main className={styles.shell}>
      <PressHeader view={view} />

      <div className={styles.sheet} key={view}>
        <section className={`${styles.cell} ${styles.objectCell}`}>
          {mounted ? (
            <PressObject
              accent={hovered}
              className={styles.object}
              reducedMotion={reducedMotion}
              view={view}
            />
          ) : null}
          <span className={styles.cellTag}>Fig. {view.toUpperCase()}</span>
        </section>

        {view === 'profile' ? (
          <>
            <section className={`${styles.cell} ${styles.span5}`}>
              <span className={styles.cellTag}>Statement</span>
              <p className={styles.lead}>
                Computer science at UCLA. Product engineering, agent workflows,
                and the small tools that should already exist.
              </p>
              <div className={styles.actions}>
                <a className={styles.button} href="mailto:tylerxiao@ucla.edu">
                  Email
                </a>
                <a
                  className={styles.buttonGhost}
                  href="/resume/resume.pdf"
                  rel="noreferrer"
                  target="_blank"
                >
                  Résumé
                </a>
              </div>
            </section>

            <section className={`${styles.cell} ${styles.span4}`}>
              <span className={styles.cellTag}>Record</span>
              <table className={styles.table}>
                <tbody>
                  {companyRun.map((entry) => (
                    <tr key={entry.company}>
                      <td>{entry.period}</td>
                      <th scope="row">{entry.company}</th>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className={`${styles.cell} ${styles.span12}`}>
              <span className={styles.cellTag}>Fixed points</span>
              <p className={styles.inline}>{personalNotes.join(' / ')}</p>
            </section>
          </>
        ) : null}

        {view === 'work'
          ? featuredProjects.map((project, index) => (
              <a
                className={`${styles.cell} ${styles.span45} ${styles.projectCell}`}
                href={project.link}
                key={project.title}
                onBlur={() => setHovered(false)}
                onFocus={() => setHovered(true)}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
                rel="noreferrer"
                target="_blank"
              >
                <span className={styles.cellTag}>
                  {String(index + 1).padStart(2, '0')} / {project.role}
                </span>
                <h2 className={styles.projectTitle}>{project.title}</h2>
                <div className={styles.shot}>
                  <Image
                    alt={`${project.title} screenshot`}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 900px) 92vw, 42vw"
                    src={project.image}
                  />
                </div>
                <p className={styles.note}>{project.description}</p>
              </a>
            ))
          : null}

        {view === 'signals' ? (
          <>
            <section className={`${styles.cell} ${styles.span9}`}>
              <span className={styles.cellTag}>Open</span>
              {experiments.map((experiment) => (
                <div className={styles.row} key={experiment.number}>
                  <span className={styles.rowKey}>{experiment.number}</span>
                  <h2 className={styles.rowTitle}>{experiment.title}</h2>
                  <span className={styles.rowStatus}>{experiment.status}</span>
                  <p className={styles.note}>{experiment.description}</p>
                </div>
              ))}
            </section>

            {/* Kept as an explicit negative rather than a fake widget. */}
            <section
              className={`${styles.cell} ${styles.span12} ${styles.void}`}
            >
              <p className={styles.voidText}>No rotation on file</p>
              <p className={styles.note}>
                Nothing in the repository records what I listen to, so this
                block stays empty instead of guessing.
              </p>
            </section>
          </>
        ) : null}

        {view === 'history' ? (
          <>
            <section className={`${styles.cell} ${styles.span9}`}>
              <span className={styles.cellTag}>Impressions</span>
              <div className={styles.eras}>
                {gitEras.map((entry, index) => (
                  <button
                    className={styles.era}
                    data-active={index === era}
                    key={entry.commit}
                    onClick={() => setEra(index)}
                    type="button"
                  >
                    <span>{entry.date.slice(0, 4)}</span>
                    {entry.label}
                  </button>
                ))}
              </div>
            </section>

            <section className={`${styles.cell} ${styles.span12}`}>
              <span className={styles.cellTag}>{gitEras[era].commit}</span>
              <h2 className={styles.projectTitle}>{gitEras[era].title}</h2>
              <p className={styles.note}>{gitEras[era].description}</p>
              <a
                className={styles.button}
                href={`${GITHUB_REPO_URL}/tree/${gitEras[era].commit}/personal-website`}
                rel="noreferrer"
                target="_blank"
              >
                Open snapshot
              </a>
            </section>
          </>
        ) : null}
      </div>

      <footer className={styles.colophon}>
        <span>Concept C · Press</span>
        <span>Set in IBM Plex · one accent, no curves</span>
        <span>main@ad3e3a7</span>
      </footer>
    </main>
  );
}

function PressHeader({ view }: { view: string }) {
  return (
    <header className={styles.masthead}>
      <h1 className={styles.wordmark}>TYLER XIAO</h1>
      <nav aria-label="Section" className={styles.index}>
        <Link className={styles.home} href="/">
          ←
        </Link>
        {conceptViews.map((entry, index) => (
          <button
            aria-pressed={entry.id === view}
            data-active={entry.id === view}
            key={entry.id}
            onClick={() => setConceptView(entry.id)}
            type="button"
          >
            {String(index + 1).padStart(2, '0')} {entry.shortLabel}
          </button>
        ))}
      </nav>
    </header>
  );
}
