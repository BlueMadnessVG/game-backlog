import { PlayTimeBar } from '../ui/PlayTimeBar';
import styles from './css/ScreenOpen.module.css';

import type { Game } from '@repo/shared';

interface ScreenOpenProps {
  activeGame: Game | undefined;
  gamesCount: number;
  openIndex: number;
  setOpenIndex: React.Dispatch<React.SetStateAction<number>>;
  onClose?: () => void;
}

export const ScreenOpen: React.FC<ScreenOpenProps> = ({
  activeGame,
  gamesCount,
  openIndex,
  setOpenIndex,
  onClose,
}) => (
  <div className={styles.viewContainer}>
    <div className={styles.headerBar}>
      <span className={styles.headerTitle}>▶ NOW PLAYING</span>
      <button className={styles.closeBtn} onClick={onClose}>
        ✕
      </button>
    </div>

    <div className={styles.openBody}>
      <div className={styles.openCoverWrapper}>
        {activeGame?.coverUrl ? (
          <img
            src={activeGame.coverUrl}
            alt={activeGame.title ?? ''}
            className={styles.coverImage}
          />
        ) : (
          <div className={`${styles.centeredFlex} ${styles.placeholderImage}`}>
            <span className={styles.placeholderEmojiOpen}>🎮</span>
          </div>
        )}
      </div>

      <div className={styles.infoPanel}>
        <span className={styles.infoTitle}>{activeGame?.title ?? '—'}</span>
        {activeGame?.playTime !== undefined && activeGame.playTime > 0 && (
          <div className={styles.playTimeSection}>
            <span className={styles.playTimeLabel}>PLAY TIME</span>
            <PlayTimeBar hours={Math.round(activeGame.playTime / 60)} />
          </div>
        )}
      </div>
    </div>

    {gamesCount > 1 && (
      <div className={styles.navBar}>
        <button
          className={styles.navBtn}
          onClick={() => setOpenIndex((i) => (i - 1 + gamesCount) % gamesCount)}
        >
          ‹
        </button>
        <span className={styles.navProgress}>
          {openIndex + 1} / {gamesCount}
        </span>
        <button className={styles.navBtn} onClick={() => setOpenIndex((i) => (i + 1) % gamesCount)}>
          ›
        </button>
      </div>
    )}
  </div>
);
