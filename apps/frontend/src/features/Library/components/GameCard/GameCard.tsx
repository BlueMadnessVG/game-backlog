import { motion, useReducedMotion } from 'framer-motion';

import styles from './components/css/GameCard.module.css';
import GameCardPoster from './components/GameCardPoster';

import type { Game } from '@repo/shared';

interface GameCardProps {
  game: Game;
}

const cardVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.03 },
};

function GameCard({ game }: GameCardProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.article
      className={styles.card_root}
      variants={cardVariants}
      initial="initial"
      whileHover={reducedMotion ? undefined : 'hover'}
      aria-label={game.title}
    >
      <GameCardPoster src={game.coverUrl} alt={game.title} />
    </motion.article>
  );
}

export default GameCard;
