import { motion } from 'framer-motion';

import styles from './css/GameDetailHeroCover.module.css';

import { getHoloTier } from '@/features/Library/components/GameCard/utils/getHoloTier';

const coverVariants = {
  initial: { opacity: 0, scale: 0.92, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0 },
};

const glowVariants = {
  initial: { opacity: 0 },
  hover: { opacity: 1 },
};

const imageVariants = {
  initial: { scale: 1, filter: 'brightness(0.85) saturate(0.9)' },
  hover: { scale: 1.04, filter: 'brightness(1)    saturate(1.1)' },
};
interface GameDetailHeroCoverProps {
  src: string | null;
  alt: string;
  completionPercentage: number;
}

function GameDetailHeroCover({ src, alt, completionPercentage }: GameDetailHeroCoverProps) {
  const tier = getHoloTier(completionPercentage);
  const coverSrc = src ?? undefined;

  return (
    <motion.div
      className={styles.cover_root}
      variants={coverVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      data-tier={tier}
    >
      <motion.div
        className={styles.cover_glow}
        variants={glowVariants}
        transition={{ duration: 0.3 }}
      />

      <motion.img
        src={coverSrc}
        alt={alt}
        className={styles.cover_image}
        variants={imageVariants}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        draggable={false}
      />

      <div className={styles.cover_tier_badge} data-tier={tier}>
        {tier.replace('_', ' ')}
      </div>

      <div className={styles.cover_percentage}>
        {Math.round(completionPercentage)}
        <span>%</span>
      </div>
    </motion.div>
  );
}

export default GameDetailHeroCover;
