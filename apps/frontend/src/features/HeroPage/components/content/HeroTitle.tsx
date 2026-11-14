import { Link } from '@tanstack/react-router';
import { motion, useTransform } from 'framer-motion';

import styles from './css/HeroTitle.module.css';
import { useAssistantStore } from '../../store/assistant.Store';
import { heroProgress } from '../../timeline';
import { prefersReducedMotion } from '../../utils/motion';

/**
 * The page's opening: "Back" and "log" start joined, then (once the load
 * counter finishes) slide to opposite edges so the cube can spin in between
 * them. The intro and the library link sit on grid columns 2–5 and leave with
 * the first scroll.
 *
 * Exports:
 *  - HeroTitle (default export too).
 */
const SPLIT = { duration: 1.1, ease: [0.76, 0, 0.24, 1] as const };

export function HeroTitle() {
  const ready = useAssistantStore((s) => s.ready);
  const reduced = prefersReducedMotion();

  const opacity = useTransform(heroProgress, [0.12, 0.3], [1, 0]);
  const y = useTransform(heroProgress, [0, 0.3], [0, -40]);
  const visibility = useTransform(heroProgress, (p) => (p >= 0.3 ? 'hidden' : 'visible'));

  return (
    <motion.div className={styles.hero} style={{ opacity, y, visibility }}>
      <h1
        className={`${styles.title} ${ready ? styles.split : ''}`}
        aria-label="Backlog"
      >
        <motion.span layout="position" transition={reduced ? { duration: 0 } : SPLIT} aria-hidden>
          Back
        </motion.span>
        <motion.span layout="position" transition={reduced ? { duration: 0 } : SPLIT} aria-hidden>
          log
        </motion.span>
      </h1>

      <div className={styles.intro}>
        <p className={styles.lede}>
          Every game you own on Steam, Xbox and PlayStation, synced into one library.
        </p>
        <Link to="/library" className={styles.cta}>
          Open your library
        </Link>
      </div>
    </motion.div>
  );
}

export default HeroTitle;
