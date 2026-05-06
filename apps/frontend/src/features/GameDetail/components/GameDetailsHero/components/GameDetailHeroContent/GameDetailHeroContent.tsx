import { motion, type Variants } from 'framer-motion';

import GameDetailHeroProgress from './components/GameDetailHeroProgress/GameDetailHeroProgress';
import GameDetailHeroStats from './components/GameDetailHeroStats/GameDetailHeroStats';
import GameDetailHeroTitle from './components/GameDetailHeroTitle/GameDetailHeroTitle';
import styles from './css/GameDetailHeroContent.module.css';

import type { Game } from '@repo/shared';

interface GameDetailHeroContentProps {
  game: Game;
}

const containerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

function GameDetailHeroContent({ game }: GameDetailHeroContentProps) {
  return (
    <motion.div
      className={styles.content_root}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={itemVariants}>
        <GameDetailHeroTitle title={game.title} platform={game.platform} status={game.status} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <GameDetailHeroProgress percentage={game.completionPercentage} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <GameDetailHeroStats
          playTime={game.playTime}
          lastPlayedAt={game.lastPlayedAt}
          status={game.status}
        />
      </motion.div>
    </motion.div>
  );
}

export default GameDetailHeroContent;
