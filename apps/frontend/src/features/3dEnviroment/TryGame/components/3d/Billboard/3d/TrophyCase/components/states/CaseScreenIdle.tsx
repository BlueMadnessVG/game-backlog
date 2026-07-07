// components/states/CaseScreenIdle.tsx
import React from 'react';

import styles from './css/CaseScreenIdle.module.css';

import type { Game } from '@repo/shared';

interface CaseScreenIdleProps {
  activeGame: Game | undefined;
  gamesCount: number;
  carouselIndex: number;
  isSelected: boolean;
  onOpen?: () => void;
}

export const CaseScreenIdle: React.FC<CaseScreenIdleProps> = ({
  activeGame,
  gamesCount,
  carouselIndex,
  isSelected,
  onOpen,
}) => (
  <div className={styles.root}>
    {/* Header */}
    <div className={styles.header}>
      <span className={styles.headerTitle}>▶ COMPLETED</span>
    </div>

    {/* Cover carousel */}
    <div className={styles.coverArea}>
      {activeGame?.coverUrl ? (
        <img src={activeGame.coverUrl} alt={activeGame.title ?? ''} className={styles.cover} />
      ) : (
        <div className={styles.coverPlaceholder}>🏆</div>
      )}

      {/* Title overlay */}
      <div className={styles.titleOverlay}>
        <span className={styles.titleText}>{activeGame?.title ?? '—'}</span>
      </div>

      {/* Dot indicators */}
      {gamesCount > 1 && (
        <div className={styles.dots}>
          {Array.from({ length: gamesCount }).map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i === carouselIndex ? styles.dotActive : styles.dotDim}`}
            />
          ))}
        </div>
      )}
    </div>

    {/* Footer */}
    <div className={styles.footer}>
      <span className={styles.count}>{gamesCount} completed</span>
      {isSelected && gamesCount > 0 && (
        <button className={styles.openBtn} onClick={onOpen}>
          [E] OPEN
        </button>
      )}
    </div>
  </div>
);
