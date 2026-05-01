import { Link } from '@tanstack/react-router';
import { HoloCardRoot } from 'holo-card';

import styles from './components/css/GameCard.module.css';
import GameCardHUD from './components/GameCardHUD';
import GameCardPoster from './components/GameCardPoster';
import { getHoloTier } from './utils/getHoloTier';

import type { Game } from '@repo/shared';

interface GameCardProps {
  game: Game;
}

function GameCard({ game }: GameCardProps) {
  const tier = getHoloTier(game.completionPercentage ?? 0);

  return (
    <Link to="/games/$id" params={{ id: game.id }} className={styles.card_link}>
      <HoloCardRoot className={styles.card_root} dataSet={tier}>
        {({ onFoilLoad }) => (
          <>
            <GameCardPoster src={game.coverUrl} alt={game.title} onLoad={onFoilLoad} />
            <GameCardHUD
              title={game.title}
              percentage={game.completionPercentage}
              playtime={game.playTime}
              platform={game.platform}
            />
          </>
        )}
      </HoloCardRoot>
    </Link>
  );
}

export default GameCard;
