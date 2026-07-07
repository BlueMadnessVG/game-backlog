// components/3d/Billboard/3d/TrophyCase/TrophyCaseScreen.tsx
/**
 * Screen content for the trophy case Html overlay.
 *
 * ── Responsibilities ─────────────────────────────────────────────────────
 * This component ONLY decides which state component to render.
 * It does NOT own the active game index — that lives in TrophyCaseMesh
 * (the single source of truth) and is passed down as a prop.
 * It does NOT call useTrophyCaseControls — TrophyCaseMesh handles that.
 *
 * ── Why index lives in TrophyCaseMesh ────────────────────────────────────
 * The index must drive two consumers simultaneously:
 *   1. The N64Cartridge 3D object (inside the Three.js scene)
 *   2. This screen's game detail view (inside the Html portal)
 * Both are children of TrophyCaseMesh, which is the natural owner.
 * Having each manage its own state caused them to drift out of sync.
 */

import React from 'react';

import { CaseScreenEmpty } from './components/states/CaseScreenEmpty';
import { CaseScreenIdle } from './components/states/CaseScreenIdle';
import { CaseScreenLoading } from './components/states/CaseScreenLoading';
import { CaseScreenOpen } from './components/states/CaseScreenOpen';

import type { Game } from '@repo/shared';

interface TrophyCaseScreenProps {
  readonly games: readonly Game[];
  readonly isLoading: boolean;
  readonly isOpen: boolean;
  readonly isSelected: boolean;
  /** Controlled from TrophyCaseMesh — do not derive independently here. */
  readonly activeIndex: number;
  readonly onOpen?: () => void;
  readonly onClose: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export const TrophyCaseScreen: React.FC<TrophyCaseScreenProps> = ({
  games,
  isLoading,
  isOpen,
  isSelected,
  activeIndex,
  onOpen,
  onClose,
  onPrev,
  onNext,
}) => {
  if (isLoading) return <CaseScreenLoading />;
  if (games.length === 0) return <CaseScreenEmpty />;

  const activeGame = games[activeIndex];

  if (isOpen) {
    return (
      <CaseScreenOpen
        activeGame={activeGame}
        gamesCount={games.length}
        openIndex={activeIndex}
        onPrev={onPrev}
        onNext={onNext}
        onClose={onClose}
      />
    );
  }

  return (
    <CaseScreenIdle
      activeGame={activeGame}
      gamesCount={games.length}
      carouselIndex={activeIndex}
      isSelected={isSelected}
      onOpen={onOpen}
    />
  );
};
