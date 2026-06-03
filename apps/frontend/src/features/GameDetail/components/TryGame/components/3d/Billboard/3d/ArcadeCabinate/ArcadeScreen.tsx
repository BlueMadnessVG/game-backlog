import React, { useState, useEffect } from 'react';

import styles from './css/ArcadeScreen.module.css';

import type { Game } from '@repo/shared';

interface ArcadeScreenProps {
  readonly games: readonly Game[];
  readonly isLoading: boolean;
  readonly isOpen: boolean;
  readonly isSelected: boolean;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

export const ArcadeScreen: React.FC<ArcadeScreenProps> = ({
  games,
  isLoading,
  isOpen,
  isSelected,
  onOpen,
  onClose,
}) => {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    if (isOpen || games.length <= 1) return;
    const id = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % games.length);
    }, 3000);
    return () => clearInterval(id);
  }, [isOpen, games.length]);

  const activeGame = isOpen ? games[openIndex] : games[carouselIndex];

  const renderContent = () => {
    if (isLoading) return <ScreenLoading />;
    if (games.length === 0) return <ScreenEmpty />;

    if (isOpen) {
      return (
        <ScreenOpen
          activeGame={activeGame}
          gamesCount={games.length}
          openIndex={openIndex}
          setOpenIndex={setOpenIndex}
          onClose={onClose}
        />
      );
    }

    return (
      <ScreenIdle
        activeGame={activeGame}
        gamesCount={games.length}
        carouselIndex={carouselIndex}
        isSelected={isSelected}
        onOpen={onOpen}
      />
    );
  };

  return (
    <div className={styles.screenRoot}>
      <div className={styles.scanlineStyle} />
      {renderContent()}
    </div>
  );
};

// ── Sub-Components (Keeps individual file/function complexity very low) ──

const ScreenLoading: React.FC = () => (
  <div className={styles.centeredFlex}>
    <span className={styles.loadingText}>LOADING…</span>
  </div>
);

const ScreenEmpty: React.FC = () => (
  <div className={styles.centeredFlex}>
    <span className={styles.emptyText}>NO GAMES YET</span>
  </div>
);

interface ScreenIdleProps {
  activeGame: Game | undefined;
  gamesCount: number;
  carouselIndex: number;
  isSelected: boolean;
  onOpen?: () => void;
}

const ScreenIdle: React.FC<ScreenIdleProps> = ({
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

interface ScreenOpenProps {
  activeGame: Game | undefined;
  gamesCount: number;
  openIndex: number;
  setOpenIndex: React.Dispatch<React.SetStateAction<number>>;
  onClose?: () => void;
}

const ScreenOpen: React.FC<ScreenOpenProps> = ({
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

const PlayTimeBar: React.FC<{ hours: number }> = ({ hours }) => {
  const MAX_BLOCKS = 10;
  const filled = Math.min(Math.round(hours / 10), MAX_BLOCKS);

  return (
    <div>
      <div className={styles.playTimeBlocks}>
        {Array.from({ length: MAX_BLOCKS }).map((_, i) => (
          <div
            key={i}
            className={`${styles.timeBlock} ${i < filled ? styles.blockActive : styles.blockDim}`}
          />
        ))}
      </div>
      <span className={styles.hoursText}>{hours} hrs</span>
    </div>
  );
};
