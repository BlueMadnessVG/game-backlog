import styles from './css/ScreenIdle.module.css';

import type { Game } from '@repo/shared';

interface ScreenIdleProps {
  activeGame: Game | undefined;
  gamesCount: number;
  carouselIndex: number;
  isSelected: boolean;
  onOpen?: () => void;
}

export const ScreenIdle: React.FC<ScreenIdleProps> = ({
  activeGame,
  gamesCount,
  carouselIndex,
  isSelected,
  onOpen,
}) => (
  <div className={styles.viewContainer}>
    <div className={styles.tickerBar}>
      <span className={styles.tickerText}>▶ NOW PLAYING ◀</span>
    </div>

    <div className={styles.carouselContainer}>
      {activeGame?.coverUrl ? (
        <img src={activeGame.coverUrl} alt={activeGame.title ?? ''} className={styles.coverImage} />
      ) : (
        <div className={`${styles.centeredFlex} ${styles.placeholderImage}`}>
          <span className={styles.placeholderEmoji}>🎮</span>
        </div>
      )}

      <div className={styles.coverTitleOverlay}>
        <span className={styles.coverTitleText}>{activeGame?.title ?? '—'}</span>
      </div>

      {gamesCount > 1 && (
        <div className={styles.dotRow}>
          {Array.from({ length: gamesCount }).map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i === carouselIndex ? styles.dotActive : styles.dotDim}`}
            />
          ))}
        </div>
      )}
    </div>

    <div className={styles.bottomBar}>
      <span className={styles.gameCountText}>
        {gamesCount} game{gamesCount !== 1 ? 's' : ''}
      </span>
      {isSelected && (
        <button className={styles.openButton} onClick={onOpen}>
          [E] OPEN
        </button>
      )}
    </div>
  </div>
);
