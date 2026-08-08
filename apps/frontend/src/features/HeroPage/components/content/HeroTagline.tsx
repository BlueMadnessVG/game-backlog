import { useState } from 'react';

import { motion, useMotionValueEvent, useTransform } from 'framer-motion';

import styles from './css/HeroTagline.module.css';
import { useScrollProgressValue } from '../../store/ScrollProgressContext';

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
