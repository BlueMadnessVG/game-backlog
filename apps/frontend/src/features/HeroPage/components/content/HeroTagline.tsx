import { useState } from 'react';

import { motion, useMotionValueEvent, useTransform } from 'framer-motion';

import styles from './css/HeroTagline.module.css';
import { useScrollProgressValue } from '../../store/ScrollProgressContext';

/**
 * Hero tagline ("One library / All platform") layered over the 3D controller.
 *
 * Drifts up slightly on early scroll and fades out once hero-relative progress
 * passes the dock threshold (0.3), making room for the deep-dive content.
 *
 * Exports:
 *  - HeroTagline: the animated tagline block (default export too).
 */
export function HeroTagline() {
  const progress = useScrollProgressValue();
  const [gone, setGone] = useState(false);

  useMotionValueEvent(progress, 'change', (latest) => {
    setGone(latest >= 0.3);
  });

  const y = useTransform(progress, [0, 0.2], [0, -24]);

  return (
    <motion.div
      className={styles.section}
      style={{ y, opacity: gone ? 0 : 1, transition: 'opacity 0.2s ease' }}
    >
      <span className={styles.taglineText}>One library All platform</span>
    </motion.div>
  );
}

export default HeroTagline;
