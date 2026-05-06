import type { RefObject } from 'react';

import { motion } from 'framer-motion';

import GameDetailHeroBanner from './components/GameDetailHeroBanner/GameDetailHeroBanner';
import GameDetailHeroContent from './components/GameDetailHeroContent/GameDetailHeroContent';
import GameDetailHeroCover from './components/GameDetailHeroCover/GameDetailHeroCover';
import GameDetailHeroGhost from './components/GameDetailHeroGhost/GameDetailHeroGhost';
import styles from './css/GameDetailsHero.module.css';

import type { Game } from '@repo/shared';

interface GamedDetailHeroProps {
  game: Game;
  scrollRef: RefObject<HTMLDivElement>;
}

const heroVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

function GameDetailsHero({ game, scrollRef }: GamedDetailHeroProps) {
  return (
    <motion.section
      className={styles.hero_root}
      variants={heroVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <GameDetailHeroBanner src={game.bannerUrl} title={game.title} scrollRef={scrollRef} />

      <div className={styles.hero_layout}>
        <GameDetailHeroCover
          src={game.coverUrl}
          alt={game.title}
          completionPercentage={game.completionPercentage}
        />

        <GameDetailHeroContent game={game} />

        <GameDetailHeroGhost percentage={game.completionPercentage} />
      </div>
    </motion.section>
  );
}

export default GameDetailsHero;
