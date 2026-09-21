import styles from './Miniatures.module.css';

export function TerminalMiniature() {
  return (
    <div className={`${styles.site} ${styles.terminal}`} aria-hidden="true">
      <div className={styles.terminalNav}>
        <strong>TYLER XIAO</strong>
        <span>
          About&nbsp;&nbsp; Past Experience&nbsp;&nbsp; Schedule a Call
        </span>
      </div>
      <div className={styles.terminalGrid}>
        <div className={styles.terminalIntro}>
          <code>{'// hi, i’m tyler'}</code>
          <strong>
            UCLA CSE student building products, backend systems, and developer
            tools.
          </strong>
          <p>From trust &amp; safety automations to multiplayer card games.</p>
          <span className={styles.greenButton}>Contact</span>
        </div>
        <div className={styles.console}>
          <pre>{`  _______      _            __   __
 |__   __|    | |           \\ \\ / /
    | |  _   _| | ___ _ __   \\ V /
    | | | | | | |/ _ \\ '__|   > <
    |_|  \\__, |_|\\___|_|    /_/ \\_
          __/ | Tyler Xiao`}</pre>
          <p>Welcome to Tyler Xiao&apos;s interactive terminal.</p>
          <span>$ </span>
          <i className={styles.cursor} />
        </div>
      </div>
    </div>
  );
}
