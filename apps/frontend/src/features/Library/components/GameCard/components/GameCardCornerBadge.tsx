import { motion } from 'framer-motion';

import styles from './css/GameCardCornerBadge.module.css';

import type { PercentageRank } from '../utils/getPercentageRank';

interface GameCardCornerBadgeProps {
  percentage: number;
  rank: PercentageRank;
}

function GameCardCornerBadge({ percentage, rank }: GameCardCornerBadgeProps) {
  return (
    <motion.div
      className={styles.corner_badge}
      data-rank={rank}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {Math.round(percentage)}%
    </motion.div>
  );
}

export default GameCardCornerBadge;
