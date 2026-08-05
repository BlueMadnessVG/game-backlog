import { motion, useTransform } from 'framer-motion';

import styles from './css/HeroTagline.module.css';
import { useScrollProgressValue } from '../../store/ScrollProgressContext';

export function HeroTagline() {
  const progress = useScrollProgressValue();

  const opacity = useTransform(progress, [0, 0.12], [1, 0]);
  const y = useTransform(progress, [0, 0.12], [0, -24]);

  return (
    <motion.div className={styles.section} style={{ opacity, y }}>
      <span className={styles.taglineText}>One library All platform</span>
    </motion.div>
  );
}

export default HeroTagline;
