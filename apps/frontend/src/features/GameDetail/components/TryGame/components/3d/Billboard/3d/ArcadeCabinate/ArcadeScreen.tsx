import React, { useCallback, useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { ScreenEmpty } from './components/states/ScreenEmpty';
import { ScreenIdle } from './components/states/ScreenIdle';
import { ScreenLoading } from './components/states/ScreenLoading';
import { ScreenOpen } from './components/states/ScreenOpen';
import styles from './css/ArcadeScreen.module.css';
import { useArcadeScreenControls } from './hooks/useArcadeScreenControls';

import type { ArcadeControls } from '@/features/GameDetail/components/TryGame/types/input';
import type { Game } from '@repo/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArcadeScreenProps {
  readonly games: readonly Game[];
  readonly isLoading: boolean;
  readonly isOpen: boolean;
  readonly isSelected: boolean;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  readonly arcadeControlsRef: React.RefObject<ArcadeControls>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cycleIndex(current: number, direction: 'prev' | 'next', length: number): number {
  if (direction === 'prev') return current === 0 ? length - 1 : current - 1;
  return current === length - 1 ? 0 : current + 1;
}

/**
 * Clamps gameIndex to a valid position without an effect.
 * If the games list shrinks and the current index is out of bounds,
 * we derive the safe value during render instead of scheduling a setState.
 */
function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(index, length - 1);
}

// ── Component ─────────────────────────────────────────────────────────────────
//
// NOTE: ArcadeScreen renders inside R3F's <Html> portal, which severs React
// context. QueryClientProvider must be applied in ArcadeCabinetMesh, wrapping
// the <Html> element — that is the only place above the portal boundary where
// useQueryClient() can still be called.
//
// This component calls useQueryClient() and receives it from that re-provided
// context. It then passes the client down as a prop to ScreenOpen so
// AchievementList can use it without crossing another context gap.
//

export const ArcadeScreen: React.FC<ArcadeScreenProps> = ({
  games,
  isLoading,
  isOpen,
  isSelected,
  onOpen,
  onClose,
  arcadeControlsRef,
}) => {
  // Safe because QueryClientProvider is applied in ArcadeCabinetMesh above <Html>
  const queryClient = useQueryClient();

  const [gameIndex, setGameIndex] = useState(0);

  // Derive safe index during render — no effect needed
  const safeGameIndex = clampIndex(gameIndex, games.length);

  // ── Navigation handlers ───────────────────────────────────────────────────
  // useCallback keeps references stable so the RAF loop in useArcadeScreenControls
  // does not restart on every render.

  const handlePrev = useCallback(() => {
    if (games.length <= 1) return;
    setGameIndex((i) => cycleIndex(clampIndex(i, games.length), 'prev', games.length));
  }, [games.length]);

  const handleNext = useCallback(() => {
    if (games.length <= 1) return;
    setGameIndex((i) => cycleIndex(clampIndex(i, games.length), 'next', games.length));
  }, [games.length]);

  const handleClose = useCallback(() => onClose?.(), [onClose]);

  useArcadeScreenControls({
    arcadeControlsRef,
    gamesCount: games.length,
    isOpen,
    onPrev: handlePrev,
    onNext: handleNext,
    onClose: handleClose,
  });

  // ── Attract mode: auto-advance carousel when screen is closed ────────────
  useEffect(() => {
    if (isOpen || games.length <= 1) return;

    const id = setInterval(() => {
      setGameIndex((i) => cycleIndex(clampIndex(i, games.length), 'next', games.length));
    }, 3000);

    return () => clearInterval(id);
  }, [isOpen, games.length]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={styles.screenRoot}>
        <div className={styles.scanlineStyle} />
        <ScreenLoading />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className={styles.screenRoot}>
        <div className={styles.scanlineStyle} />
        <ScreenEmpty />
      </div>
    );
  }

  const activeGame = games[safeGameIndex];

  return (
    <div className={styles.screenRoot}>
      <div className={styles.scanlineStyle} />

      {isOpen ? (
        <ScreenOpen
          activeGame={activeGame}
          gamesCount={games.length}
          openIndex={safeGameIndex}
          setOpenIndex={setGameIndex}
          onClose={onClose}
          queryClient={queryClient}
        />
      ) : (
        <ScreenIdle
          activeGame={activeGame}
          gamesCount={games.length}
          carouselIndex={safeGameIndex}
          isSelected={isSelected}
          onOpen={onOpen}
        />
      )}
    </div>
  );
};
