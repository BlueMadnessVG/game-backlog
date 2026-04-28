// GameCardWaterProgress.tsx
import { motion, useReducedMotion } from 'framer-motion';

import styles from './css/GameCard.module.css';

interface GameCardWaterProgressProps {
  percentage: number;
}

const waterVariants = {
  initial: { height: '0%', opacity: 0 },
  animate: { height: '0%', opacity: 0 },
  hover: (pct: number) => ({
    height: `${pct}%`,
    opacity: 1,
  }),
};

function GameCardWaterProgress({ percentage }: GameCardWaterProgressProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return null;

  return (
    <motion.div
      className={styles.water_fill}
      variants={waterVariants}
      custom={percentage}
      transition={{
        height: { duration: 1.2, ease: 'circOut' },
        opacity: { duration: 0.2 },
      }}
    />
  );
}

export default GameCardWaterProgress;
