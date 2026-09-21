import styles from './Miniatures.module.css';

const orbitNames = ['ATLAS', 'PROFILE', 'PROJECTS', 'INSIGHTS', 'CONNECT'];

export function OrbitalMiniature() {
  return (
    <div className={`${styles.site} ${styles.orbital}`} aria-hidden="true">
      <header>
        <strong>
          Tyler Xiao&apos;s <em>portfolio</em>
        </strong>
        <span>● Terminal</span>
      </header>
      <p>
        Selected work across AI systems, backend infrastructure, and product
        engineering.
      </p>
      <div className={styles.orbitSystem}>
        {orbitNames.map((name, index) => (
          <div
            className={styles.orbit}
            key={name}
            style={
              {
                '--orbit-size': `${25 + index * 13}%`,
                '--orbit-tilt': `${-18 + index * 8}deg`,
              } as React.CSSProperties
            }
          >
            <i />
          </div>
        ))}
        <b />
      </div>
      <ol>
        {orbitNames.map((name, index) => (
          <li key={name}>
            {['I', 'II', 'III', 'IV', 'V'][index]} · {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
