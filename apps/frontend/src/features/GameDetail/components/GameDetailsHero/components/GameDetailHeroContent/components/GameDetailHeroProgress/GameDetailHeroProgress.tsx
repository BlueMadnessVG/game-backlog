import { motion } from 'framer-motion';

import styles from './css/GameDetailHeroProgress.module.css';

interface GameDetailHeroProgressProps {
  percentage: number;
}

function GameDetailHeroProgress({ percentage }: GameDetailHeroProgressProps) {
  const rounded = Math.round(percentage);

  return (
    <div className={styles.progress_root}>
      <div className={styles.progress_track}>
        <motion.div
          className={styles.progress_fill}
          initial={{ width: '0%' }}
          animate={{ width: `${rounded}%` }}
          transition={{ duration: 1.2, ease: 'circOut', delay: 0.4 }}
        />
        <motion.div
          className={styles.progress_tip}
          initial={{ left: '0%', opacity: 0 }}
          animate={{ left: `${rounded}%`, opacity: rounded > 0 ? 1 : 0 }}
          transition={{ duration: 1.2, ease: 'circOut', delay: 0.4 }}
        />
      </div>

      <motion.span
        className={styles.progress_label}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {rounded}
        <span className={styles.progress_unit}>%</span>
      </motion.span>
    </div>
  );
}

export default GameDetailHeroProgress;
