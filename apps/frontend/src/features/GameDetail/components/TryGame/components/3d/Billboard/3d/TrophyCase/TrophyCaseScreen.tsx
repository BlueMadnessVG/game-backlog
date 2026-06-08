// components/3d/Billboard/3d/TrophyCase/TrophyCaseScreen.tsx
/**
 * Screen content rendered inside the trophy case's Html overlay.
 *
 * Delegates rendering to four focused state components:
 *   CaseScreenLoading → spinner while data loads
 *   CaseScreenEmpty   → "no completed games" placeholder
 *   CaseScreenIdle    → carousel of completed game covers (not yet opened)
 *   CaseScreenOpen    → full game detail with completion badge + play time
 *
 * SRP: this component only decides WHICH state to render — it owns
 * no styling or business logic itself.
 */

import React, { useState, useEffect, useCallback } from 'react';

import { Html } from '@react-three/drei';

import { CaseScreenEmpty } from './components/states/CaseScreenEmpty';
import { CaseScreenIdle } from './components/states/CaseScreenIdle';
import { CaseScreenLoading } from './components/states/CaseScreenLoading';
import { CaseScreenOpen } from './components/states/CaseScreenOpen';
import { useTrophyCaseControls } from './hooks/useTrophyCaseControls';

import type { ArcadeControls } from '../../../../../types/input';
import type { Game } from '@repo/shared';

// Screen pixel dimensions — sized for the glass cabinet section
const SCREEN_W = 280;
const SCREEN_H = 200;

interface TrophyCaseScreenProps {
  readonly games: readonly Game[];
  readonly isLoading: boolean;
  readonly isOpen: boolean;
  readonly isSelected: boolean;
  readonly arcadeControlsRef?: React.RefObject<ArcadeControls>;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

export const TrophyCaseScreen: React.FC<TrophyCaseScreenProps> = ({
  games,
  isLoading,
  isOpen,
  isSelected,
  arcadeControlsRef,
  onOpen,
  onClose,
}) => {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState(0);

  // Auto-advance carousel while screen is idle
  useEffect(() => {
    if (isOpen || games.length <= 1) return;
    const id = setInterval(() => setCarouselIndex((i) => (i + 1) % games.length), 3500);
    return () => clearInterval(id);
  }, [isOpen, games.length]);

  const handlePrev = useCallback(
    () => setOpenIndex((i) => (i - 1 + games.length) % games.length),
    [games.length],
  );
  const handleNext = useCallback(() => setOpenIndex((i) => (i + 1) % games.length), [games.length]);
  const handleClose = useCallback(() => onClose?.(), [onClose]);

  // Wire arcade controls (ArrowLeft/Right/Escape) to the open screen
  useTrophyCaseControls({
    arcadeControlsRef,
    gamesCount: games.length,
    isOpen,
    onPrev: handlePrev,
    onNext: handleNext,
    onClose: handleClose,
  });

  const activeGame = isOpen ? games[openIndex] : games[carouselIndex];

  const renderState = () => {
    if (isLoading) return <CaseScreenLoading />;
    if (games.length === 0) return <CaseScreenEmpty />;
    if (isOpen)
      return (
        <CaseScreenOpen
          activeGame={activeGame}
          gamesCount={games.length}
          openIndex={openIndex}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={handleClose}
        />
      );
    return (
      <CaseScreenIdle
        activeGame={activeGame}
        gamesCount={games.length}
        carouselIndex={carouselIndex}
        isSelected={isSelected}
        onOpen={onOpen}
      />
    );
  };

  return (
    <Html
      transform
      occlude
      style={{
        width: SCREEN_W,
        height: SCREEN_H,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {renderState()}
    </Html>
  );
};
