import styles from './Miniatures.module.css';

export function DuskMiniature() {
  return (
    <div className={`${styles.site} ${styles.dusk}`} aria-hidden="true">
      <header>
        <strong>
          Tyler Xiao&apos;s <em>portfolio</em>
        </strong>
        <span>1,284 visits&nbsp;&nbsp; ● Terminal</span>
      </header>
      <p>
        Selected work across AI systems, backend infrastructure, and product
        engineering.
      </p>
      <div className={styles.duskOrbit}>
        {[0, 1, 2, 3, 4].map((index) => (
          <i
            key={index}
            style={
              {
                '--dusk-size': `${28 + index * 14}%`,
                '--dusk-turn': `${index * 11 - 20}deg`,
              } as React.CSSProperties
            }
          />
        ))}
        <b />
      </div>
      <div className={styles.duskIndex}>
        <span>I&nbsp; Atlas</span>
        <span>II&nbsp; Profile</span>
        <span>III&nbsp; Projects</span>
        <span>IV&nbsp; Insights</span>
        <span>V&nbsp; Connect</span>
      </div>
      <small>Mono&nbsp;&nbsp; Ember&nbsp;&nbsp; Ice&nbsp;&nbsp; Terminal</small>
    </div>
  );
}
