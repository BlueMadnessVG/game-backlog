import { motion } from 'framer-motion';

import styles from './css/GameDetailHeroGhost.module.css';

interface GameDetailHeroGhostProps {
  percentage: number;
}

const ghostVariants = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
};

function GameDetailHeroGhost({ percentage }: GameDetailHeroGhostProps) {
  const rounded = Math.round(percentage);

  return (
    <motion.div
      className={styles.ghost_root}
      variants={ghostVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
    >
      <span className={styles.ghost_number}>{rounded}</span>
      <span className={styles.ghost_unit}>%</span>
    </motion.div>
  );
}

export default GameDetailHeroGhost;
