import styles from './css/GameDetailHeroTitle.module.css';

import type { GameStatus, Platform } from '@repo/shared';

interface GameDetailHeroTitleProps {
  title: string;
  platform: Platform;
  status: GameStatus;
}

function GameDetailHeroTitle({ title, platform }: GameDetailHeroTitleProps) {
  return (
    <div className={styles.title_root}>
      <div className={styles.title_meta}>
        <span className={styles.platform_tag}>{platform}</span>
      </div>
      <h1 className={styles.title}>{title}</h1>
    </div>
  );
}

export default GameDetailHeroTitle;
