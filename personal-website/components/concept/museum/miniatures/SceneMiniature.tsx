import styles from './Miniatures.module.css';

const sceneLabels = ['Home', 'About', 'Projects', 'Blog', 'Contact'];

export function SceneMiniature() {
  return (
    <div className={`${styles.site} ${styles.scene}`} aria-hidden="true">
      <div className={styles.sceneTop}>
        <strong>TX</strong>
        <span>● Terminal</span>
      </div>
      <div className={styles.sceneName}>Tyler Xiao</div>
      <div className={styles.sceneRing}>
        {sceneLabels.map((label, index) => (
          <div
            className={styles.sceneCard}
            key={label}
            style={
              { '--card-angle': `${index * 72}deg` } as React.CSSProperties
            }
          >
            <i>{['◈', '◐', '▣', '◫', '◎'][index]}</i>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className={styles.sceneThemes}>
        Theme&nbsp; ○ &nbsp;●&nbsp; ○ &nbsp;○
      </div>
    </div>
  );
}
