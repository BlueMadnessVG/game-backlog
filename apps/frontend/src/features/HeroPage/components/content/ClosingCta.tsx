import { Link } from '@tanstack/react-router';

import styles from './css/ClosingCta.module.css';

/**
 * Last screen: one sentence and one action. The assistant cube docks in the
 * slot beside it.
 *
 * Exports:
 *  - ClosingCta (default export too).
 */
export function ClosingCta() {
  return (
    <section className={styles.section} aria-labelledby="cta-heading">
      <div className={styles.copy}>
        <h2 id="cta-heading" className={styles.heading}>
          Your backlog, in one place
        </h2>
        <Link to="/library" className={styles.cta}>
          Open your library
        </Link>
        <p className={styles.credit}>
          Placeholder cube model by{' '}
          <a href="https://sketchfab.com/rippomadness" target="_blank" rel="noreferrer">
            rippomadness
          </a>
          ,{' '}
          <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </p>
      </div>
      <div className={styles.slot} data-assistant-slot="cta" aria-hidden />
    </section>
  );
}

export default ClosingCta;
