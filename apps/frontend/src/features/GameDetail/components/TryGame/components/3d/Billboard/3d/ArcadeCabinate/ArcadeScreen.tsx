import React, { useState, useEffect } from 'react';

import { ScreenEmpty } from './components/states/ScreenEmpty';
import { ScreenIdle } from './components/states/ScreenIdle';
import { ScreenLoading } from './components/states/ScreenLoading';
import { ScreenOpen } from './components/states/ScreenOpen';
import styles from './css/ArcadeScreen.module.css';
import { useArcadeScreenControls } from './hooks/useArcadeScreenControls';

import type { ArcadeControls } from '@/features/GameDetail/components/TryGame/types/input';
import type { Game } from '@repo/shared';

interface ArcadeScreenProps {
  readonly games: readonly Game[];
  readonly isLoading: boolean;
  readonly isOpen: boolean;
  readonly isSelected: boolean;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  readonly arcadeControlsRef: React.RefObject<ArcadeControls>;
}

export const ArcadeScreen: React.FC<ArcadeScreenProps> = ({
  games,
  isLoading,
  isOpen,
  isSelected,
  onOpen,
  onClose,
  arcadeControlsRef,
}) => {
  // Single source of truth index for both states
  const [gameIndex, setGameIndex] = useState(0);

  // ── Handlers linked directly to input router navigation ─────────────────
  const handlePrev = () => {
    if (games.length <= 1) return;
    setGameIndex((prev) => (prev === 0 ? games.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (games.length <= 1) return;
    setGameIndex((prev) => (prev === games.length - 1 ? 0 : prev + 1));
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  // ── Sync internal hooks to read the RAF loop ref matrices ───────────────
  useArcadeScreenControls({
    arcadeControlsRef,
    gamesCount: games.length,
    isOpen,
    onPrev: handlePrev,
    onNext: handleNext,
    onClose: handleClose,
  });

  // ── Attract Mode: Idle Autoplay Ticker (only runs when closed) ──────────
  useEffect(() => {
    if (isOpen || games.length <= 1) return;

    const id = setInterval(() => {
      setGameIndex((i) => (i + 1) % games.length);
    }, 3000);

    return () => clearInterval(id);
  }, [isOpen, games.length]);

  const activeGame = games[gameIndex];

  const renderContent = () => {
    if (isLoading) return <ScreenLoading />;
    if (games.length === 0) return <ScreenEmpty />;

    if (isOpen) {
      return (
        <ScreenOpen
          activeGame={activeGame}
          gamesCount={games.length}
          openIndex={gameIndex}
          setOpenIndex={setGameIndex}
          onClose={onClose}
        />
      );
    }

    return (
      <ScreenIdle
        activeGame={activeGame}
        gamesCount={games.length}
        carouselIndex={gameIndex}
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
