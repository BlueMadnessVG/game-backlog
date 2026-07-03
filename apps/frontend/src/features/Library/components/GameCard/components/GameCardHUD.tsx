import styles from './css/GameCardHUD.module.css';
import GameCardCornerBadge from './GameCardCornerBadge';
import { GameCardMetadata } from './GameCardMetadata';
import GameCardPlatformTag from './GameCardPlatformTag';
import { getPercentageRank } from '../utils/getPercentageRank';

interface GameCardHUDProps {
  title: string;
  percentage: number;
  playtime: number;
  platform: string;
}

function GameCardHUD({ title, percentage, playtime, platform }: GameCardHUDProps) {
  const rank = getPercentageRank(percentage);

  return (
    <div className={styles.hud_overlay}>
      <GameCardCornerBadge percentage={percentage} rank={rank} />
      <GameCardPlatformTag platform={platform} rank={rank} />
      <GameCardMetadata title={title} playTime={playtime} />
    </div>
  );
}

export default GameCardHUD;
