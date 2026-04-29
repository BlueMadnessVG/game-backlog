import { HoloCardRoot } from 'holo-card';

import styles from './components/css/GameCard.module.css';
import GameCardHUD from './components/GameCardHUD';
import GameCardPoster from './components/GameCardPoster';

import type { Game } from '@repo/shared';

interface GameCardProps {
  game: Game;
}

function GameCard({ game }: GameCardProps) {
  return (
    <HoloCardRoot className={styles.card_root} dataSet="Shiny">
      <GameCardPoster src={game.coverUrl} alt={game.title} />
      <GameCardHUD
        title={game.title}
        percentage={game.completionPercentage}
        playtime={game.playTime}
        platform={game.platform}
      />
    </HoloCardRoot>
  );
}

export default GameCard;
