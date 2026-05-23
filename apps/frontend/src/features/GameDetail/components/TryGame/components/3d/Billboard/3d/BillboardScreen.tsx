import React from 'react';

import s from './css/BillboardScreen.module.css';

import type { GAME_CATEGORY_CONFIG, GameCategory } from '../../../../types/billboard';
import type { Game } from '@repo/shared';

interface BillboardScreenProps {
  config: (typeof GAME_CATEGORY_CONFIG)[GameCategory];
  games: readonly Game[];
  isLoading: boolean;
  isOpen: boolean;
  selectedGame: Game | undefined;
  selectedIndex: number;
  onPrev?: () => void;
  onNext?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
  isSelected: boolean;
  screenW: number;
  screenH: number;
}

const BillboardScreen: React.FC<BillboardScreenProps> = ({
  config,
  games,
  isLoading,
  isOpen,
  selectedGame,
  selectedIndex,
  onPrev,
  onNext,
  onOpen,
  onClose,
  isSelected,
  screenW,
  screenH,
}) => {
  // Pass dynamic parameters safely into the CSS Module using CSS Custom Properties
  const dynamicVars = {
    '--accent': config.color,
    '--w': `${screenW}px`,
    '--h': `${screenH}px`,
  } as React.CSSProperties;

  if (isLoading) {
    return (
      <div className={s.root} style={dynamicVars}>
        <div className={s.loading}>Loading…</div>
      </div>
    );
  }

  if (!isOpen) {
    // Idle / proximity view
    return (
      <div className={s.root} style={dynamicVars}>
        <div className={s.idleLabel}>{config.label}</div>
        <div className={s.idleCount}>
          {games.length} {games.length === 1 ? 'game' : 'games'}
        </div>
        {isSelected && games.length > 0 && (
          <button className={s.openBtn} onClick={onOpen}>
            Press E · View
          </button>
        )}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className={s.root} style={dynamicVars}>
        <div className={s.idleLabel}>{config.label}</div>
        <div className={s.idleCount}>No games yet.</div>
      </div>
    );
  }

  return (
    <div className={s.root} style={dynamicVars}>
      {/* Header */}
      <div className={s.header}>
        <span className={s.headerTitle}>{config.label}</span>
        <button className={s.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Cover */}
      {selectedGame?.coverUrl ? (
        <img src={selectedGame.coverUrl} alt={selectedGame.title} className={s.cover} />
      ) : (
        <div className={s.coverPlaceholder} />
      )}

      {/* Info */}
      <div className={s.info}>
        <div className={s.gameTitle}>{selectedGame?.title}</div>
        {selectedGame?.playTime !== undefined && selectedGame.playTime > 0 && (
          <div className={s.meta}>{Math.round(selectedGame.playTime / 60)} hrs played</div>
        )}
      </div>

      {/* Navigation */}
      <div className={s.nav}>
        <button className={s.navBtn} onClick={onPrev} disabled={games.length <= 1}>
          ‹
        </button>
        <span className={s.navCount}>
          {selectedIndex + 1} / {games.length}
        </span>
        <button className={s.navBtn} onClick={onNext} disabled={games.length <= 1}>
          ›
        </button>
      </div>
    </div>
  );
};

export default BillboardScreen;
