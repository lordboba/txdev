import type { GitEra } from '../conceptData';
import { DuskMiniature } from './miniatures/DuskMiniature';
import { FoundationMiniature } from './miniatures/FoundationMiniature';
import { OrbitalMiniature } from './miniatures/OrbitalMiniature';
import { ProofMiniature } from './miniatures/ProofMiniature';
import { SceneMiniature } from './miniatures/SceneMiniature';
import { TerminalMiniature } from './miniatures/TerminalMiniature';
import styles from './Museum.module.css';

const MINIATURES = [
  FoundationMiniature,
  TerminalMiniature,
  SceneMiniature,
  OrbitalMiniature,
  DuskMiniature,
  ProofMiniature,
] as const;

export function Miniature({
  era,
  index,
  selected,
}: {
  era: GitEra;
  index: number;
  selected: boolean;
}) {
  const EraMiniature = MINIATURES[index];

  return (
    <article
      aria-current={selected ? 'true' : undefined}
      className={styles.exhibit}
      data-era-index={index}
    >
      <div className={styles.miniatureFrame}>
        <div className={styles.miniatureCanvas}>
          <div className={styles.miniatureScale} data-miniature-stage>
            <EraMiniature />
          </div>
        </div>
      </div>
      <div className={styles.placard}>
        <div className={styles.catalogue}>
          <code>{era.commit}</code>
          <time dateTime={era.date}>{era.date}</time>
        </div>
        <h2>{era.title}</h2>
        <p>{era.description}</p>
        <span>{era.visualLanguage}</span>
      </div>
    </article>
  );
}
