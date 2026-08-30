import Image from 'next/image';
import { experiments, gitEras, personalNotes } from '../conceptData';
import { featuredProjects } from '../../../content/projectData';
import { companyRun } from '../../../content/experienceData';
import { Miniature } from './Miniature';
import styles from './Museum.module.css';

export function HistoryView({ selected }: { selected: number }) {
  return (
    <section
      aria-label="Six eras of this website"
      className={styles.historyView}
    >
      <div className={styles.galleryWall}>
        {gitEras.map((era, index) => (
          <Miniature
            era={era}
            index={index}
            key={era.commit}
            selected={selected === index}
          />
        ))}
      </div>
    </section>
  );
}

export function ProfileView() {
  return (
    <section aria-labelledby="profile-title" className={styles.profileView}>
      <div className={styles.portraitHang}>
        <div className={styles.portraitFrame}>
          <Image
            alt="Tyler Xiao"
            className={styles.portrait}
            height={900}
            priority
            src="/pfp.JPG"
            width={1350}
          />
        </div>
        <div className={`${styles.wallText} ${styles.portraitText}`}>
          <p className={styles.kicker}>Portrait of the maintainer</p>
          <h2 id="profile-title">The person behind the commits</h2>
          <ul>
            {personalNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.loanLedger}>
        <p className={styles.kicker}>On loan to</p>
        {companyRun.map((entry) => (
          <div
            className={styles.ledgerRow}
            key={`${entry.company}-${entry.period}`}
          >
            <strong>{entry.company}</strong>
            <time>{entry.period}</time>
            <span>{entry.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorkView() {
  return (
    <section aria-labelledby="work-title" className={styles.workView}>
      <div className={styles.viewIntro}>
        <p className={styles.kicker}>Acquisitions</p>
        <h2 id="work-title">Four works, shown with evidence</h2>
      </div>
      <div className={styles.salonWall}>
        {featuredProjects.map((project, index) => (
          <article
            className={`${styles.projectHang} ${styles[`projectHang${index + 1}`]}`}
            key={project.title}
          >
            <a href={project.link} rel="noreferrer" target="_blank">
              <div className={styles.projectFrame}>
                <Image
                  alt={`${project.title} product screenshot`}
                  height={900}
                  sizes="(max-width: 700px) 86vw, 38vw"
                  src={project.image}
                  width={1600}
                />
              </div>
              <div className={styles.projectPlacard}>
                <span>
                  {project.role} · {project.accent}
                </span>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <strong>View live work ↗</strong>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SignalsView() {
  return (
    <section aria-labelledby="signals-title" className={styles.signalsView}>
      <div className={styles.viewIntro}>
        <p className={styles.kicker}>New wing under construction</p>
        <h2 id="signals-title">Experiments awaiting exhibition</h2>
      </div>
      <div className={styles.crateRoom}>
        {experiments.map((experiment, index) => (
          <article
            className={`${styles.cratedExhibit} ${styles[`crate${index + 1}`]}`}
            key={experiment.number}
          >
            <div className={styles.crate}>
              <div className={styles.dustSheet}>
                <span>{experiment.title}</span>
              </div>
              <strong>{experiment.status}</strong>
            </div>
            <div className={styles.curatorNote}>
              <code>Study {experiment.number}</code>
              <h3>{experiment.title}</h3>
              <p>{experiment.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
