import Image from 'next/image';
import styles from './Miniatures.module.css';

const proofs = [
  ['/projects/icalarms.png', 'iCalarms'],
  ['/projects/charades-2026.png', 'Charades 2026'],
  ['/projects/personal-env-card.svg', 'Personal Env'],
];

export function ProofMiniature() {
  return (
    <div className={`${styles.site} ${styles.proof}`} aria-hidden="true">
      <header>
        <strong>
          Tyler Xiao&apos;s <em>portfolio</em>
        </strong>
        <span>● Terminal</span>
      </header>
      <div className={styles.proofBody}>
        <div className={styles.proofOrbit}>
          {[0, 1, 2, 3].map((index) => (
            <i key={index} style={{ inset: `${index * 8 + 5}%` }} />
          ))}
          <b />
        </div>
        <div className={styles.proofPanel}>
          <small>SELECTED PROJECTS</small>
          {proofs.map(([image, title]) => (
            <div className={styles.proofRow} key={title}>
              <Image alt="" height={90} src={image} width={160} />
              <span>
                <strong>{title}</strong>
                <small>Live website →</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
