'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  conceptViews,
  experiments,
  featuredProjects,
  gitEras,
  personalNotes,
} from '../conceptData';
import { setConceptView, useConceptView } from '../conceptViewStore';
import { useMounted, usePrefersReducedMotion } from '../shared/runtime';
import { Monolith } from './Monolith';
import { FACE_ORDER, setHover } from './monolithStore';
import styles from './Archive.module.css';

const GITHUB_REPO_URL = 'https://github.com/lordboba/txdev';

export function Archive() {
  const view = useConceptView();
  const reducedMotion = usePrefersReducedMotion();
  const mounted = useMounted();
  const [era, setEra] = useState(gitEras.length - 1);
  const faceIndex = FACE_ORDER.indexOf(view);

  const handleFace = useCallback((face: number) => {
    setConceptView(FACE_ORDER[face]);
  }, []);

  const selectEra = useCallback((index: number) => {
    setEra(index);
    setHover(index);
  }, []);

  return (
    <main className={styles.shell}>
      {mounted ? (
        <Monolith
          className={styles.canvas}
          onFace={handleFace}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <Link className={styles.back} href="/">
        ← Tyler Xiao
      </Link>

      <div className={styles.dock} key={view}>
        {view === 'profile' ? (
          <>
            <h1 className={styles.title}>Tyler Xiao</h1>
            <p className={styles.lede}>
              Computer science at UCLA. I build product, agent workflows, and
              the small tools that should already exist.
            </p>
            <ul className={styles.facts}>
              {personalNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className={styles.links}>
              <a href="mailto:tylerxiao@ucla.edu">Email</a>
              <a href="/resume/resume.pdf" rel="noreferrer" target="_blank">
                Résumé
              </a>
            </div>
          </>
        ) : null}

        {view === 'work' ? (
          <>
            <h1 className={styles.title}>Shipped</h1>
            <ul className={styles.entries}>
              {featuredProjects.map((project, index) => (
                <li key={project.title}>
                  <a
                    href={project.link}
                    onBlur={() => setHover(-1)}
                    onFocus={() => setHover(index)}
                    onPointerEnter={() => setHover(index)}
                    onPointerLeave={() => setHover(-1)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <strong>{project.title}</strong>
                    <span>{project.role}</span>
                  </a>
                  <p>{project.description}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {view === 'signals' ? (
          <>
            <h1 className={styles.title}>In progress</h1>
            <ul className={styles.entries}>
              {experiments.map((experiment) => (
                <li key={experiment.number}>
                  <strong>{experiment.title}</strong>
                  <span>{experiment.status}</span>
                  <p>{experiment.description}</p>
                </li>
              ))}
            </ul>
            <p className={styles.aside}>
              There is no listening section here. The repository does not record
              one, and inventing a rotation would be the only dishonest thing on
              the page.
            </p>
          </>
        ) : null}

        {view === 'history' ? (
          <>
            <h1 className={styles.title}>Strata</h1>
            <div className={styles.eras}>
              {gitEras.map((entry, index) => (
                <button
                  className={styles.eraButton}
                  data-active={index === era}
                  key={entry.commit}
                  onClick={() => selectEra(index)}
                  onPointerEnter={() => setHover(index)}
                  onPointerLeave={() => setHover(era)}
                  type="button"
                >
                  <span>{entry.date.slice(0, 4)}</span>
                  {entry.label}
                </button>
              ))}
            </div>
            <p className={styles.lede}>{gitEras[era].title}</p>
            <p className={styles.aside}>{gitEras[era].description}</p>
            <div className={styles.links}>
              <a
                href={`${GITHUB_REPO_URL}/tree/${gitEras[era].commit}/personal-website`}
                rel="noreferrer"
                target="_blank"
              >
                {gitEras[era].commit}
              </a>
            </div>
          </>
        ) : null}
      </div>

      <footer className={styles.rail}>
        <span className={styles.hint}>
          Drag the object to turn it · {String(faceIndex + 1).padStart(2, '0')}{' '}
          of 04
        </span>
        <nav aria-label="Monolith face" className={styles.faces}>
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
      </footer>
    </main>
  );
}
