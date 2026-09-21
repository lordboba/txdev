import styles from './Miniatures.module.css';

export function FoundationMiniature() {
  return (
    <div className={`${styles.site} ${styles.foundation}`} aria-hidden="true">
      <div className={styles.nextMark}>
        N<span>▲</span>XT
      </div>
      <div className={styles.foundationCopy}>
        <strong>To get started, edit the page.tsx file.</strong>
        <p>
          Looking for a starting point or more instructions? Head over to
          Templates or the Learning center.
        </p>
      </div>
      <div className={styles.foundationActions}>
        <span>▲ Deploy Now</span>
        <span>Documentation</span>
      </div>
    </div>
  );
}
