import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import styles from './css/GameCard.module.css';

interface GameCardPosterProps {
  src: string | null;
  alt: string;
  isHovered: boolean;
}

const posterVariants = {
  initial: { opacity: 1, filter: 'saturate(0) brightness(0)' },
  animate: { opacity: 1, filter: 'saturate(0.8) brightness(0.8)' },
  hover: { filter: 'saturate(1) brightness(1)' },
  exit: { opacity: 0 },
};

const fallbackVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

function GameCardPoster({ src, alt, isHovered }: GameCardPosterProps) {
  const [hasError, setHasError] = useState(!src);
  const animateState = isHovered ? 'hover' : 'animate';

  return (
    <div className={styles.poster_container}>
      <AnimatePresence mode="wait">
        {src && !hasError ? (
          <motion.img
            key="image"
            src={src}
            alt={alt}
            className={styles.poster_image}
            variants={posterVariants}
            initial="initial"
            animate={animateState}
            exit="exit"
            onError={() => setHasError(true)}
            loading="lazy"
          />
        ) : (
          <motion.div
            key="fallback"
            className={styles.poster_fallback}
            variants={fallbackVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className={styles.fallback_content}>
              <span className={styles.fallback_icon}>[ ! ]</span>
              <p className={styles.fallback_text}>{alt}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GameCardPoster;
