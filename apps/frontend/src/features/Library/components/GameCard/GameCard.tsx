import { useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import styles from './components/css/GameCard.module.css';
import GameCardHUD from './components/GameCardHUD';
import GameCardPoster from './components/GameCardPoster';
import GameCardWaterProgress from './components/GameCardWaterProgress';

import type { Game } from '@repo/shared';

interface GameCardProps {
  game: Game;
}

const cardVariants = {
  initial: { scale: 1 },
  animate: { scale: 1 },
  hover: { scale: 1.03 },
};

function GameCard({ game }: GameCardProps) {
  const reducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.article
      className={styles.card_root}
      variants={cardVariants}
      initial="initial"
      whileHover={reducedMotion ? undefined : 'hover'}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      aria-label={game.title}
    >
      <GameCardPoster src={game.coverUrl} alt={game.title} isHovered={isHovered} />

      <GameCardWaterProgress percentage={game.completionPercentage ?? 0} />

      <GameCardHUD
        title={game.title}
        percentage={game.completionPercentage}
        playtime={game.playTime}
        platform={game.platform}
      />
    </motion.article>
  );
}

export default GameCard;
