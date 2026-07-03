import { motion, type Variants } from 'framer-motion';

import styles from './css/GameCardMetadata.module.css';

import { formatPlayTime } from '@/common/utils/Formatting/formatPlayTime.utils';

interface GameCardMetadataProps {
  title: string;
  playTime: number;
}

const containerVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  hover: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const GameCardMetadata = ({ title, playTime }: GameCardMetadataProps) => {
  return (
    <motion.div className={styles.stats_container} variants={containerVariants}>
      <h3 className={styles.game_title}>{title}</h3>

      <div className={styles.playtime}>
        <span>{formatPlayTime(playTime)}</span>
      </div>
    </motion.div>
  );
};
