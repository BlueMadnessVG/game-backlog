import React, { useCallback, useEffect, useRef } from 'react';

import * as THREE from 'three';

import { Billboard } from './BillboardMesh';
import {
  useBillboardInteraction,
  useBillboardProximity,
} from '../../../../hooks/useBillboardProximity';
import { useGamesByCategory } from '../../../../hooks/useGamesByCategory';
import { BILLBOARD_INTERACTION_DISTANCE } from '../../../../types/billboard';
import { BillboardOverlay } from '../display/BillboardOverlay';
import { InteractionPrompt } from '../display/InteractionPrompt';

import type { BillboardConfig } from '../../../../types/billboard';

interface BillboardsProps {
  readonly carPositionRef: React.RefObject<THREE.Group | null>;
}

const DEFAULT_BILLBOARDS: readonly BillboardConfig[] = [
  {
    position: [-20, 0, -15] as const,
    width: 8,
    height: 6,
    rotation: [0, -Math.PI / 8, 0] as const,
    category: 'playing' as const,
  },
  {
    position: [20, 0, -15] as const,
    width: 8,
    height: 6,
    rotation: [0, Math.PI / 8, 0] as const,
    category: 'completed' as const,
  },
  {
    position: [0, 0, 30] as const,
    width: 8,
    height: 6,
    rotation: [0, 0, 0] as const,
    category: 'backlog' as const,
  },
];

export const Billboards: React.FC<BillboardsProps> = ({ carPositionRef }) => {
  const { isLoading, getGamesByCategory } = useGamesByCategory();
  const { selectedCategory, isModalOpen, openBillboard, closeBillboard } =
    useBillboardInteraction('playing');

  const proximity = useBillboardProximity(carPositionRef, DEFAULT_BILLBOARDS);

  const interactionKeyHandledRef = useRef(false);

  const displayedGames = getGamesByCategory(selectedCategory);

  // Handle interaction key (E or Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
        if (
          proximity.closestBillboard &&
          proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE &&
          !isModalOpen &&
          !interactionKeyHandledRef.current
        ) {
          openBillboard(proximity.closestBillboard.category);
          interactionKeyHandledRef.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
        interactionKeyHandledRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [proximity, isModalOpen, openBillboard]);

  const isNearby = useCallback(
    (billboard: BillboardConfig): boolean => {
      return proximity.nearbyBillboards.some((b) => b.category === billboard.category);
    },
    [proximity.nearbyBillboards],
  );

  const isClosest = useCallback(
    (billboard: BillboardConfig): boolean => {
      return proximity.closestBillboard?.category === billboard.category;
    },
    [proximity.closestBillboard],
  );

  return (
    <>
      {/* 3D Billboards */}
      {DEFAULT_BILLBOARDS.map((billboard) => (
        <Billboard
          games={[]}
          isLoading={false}
          onClose={function (): void {
            throw new Error('Function not implemented.');
          }}
          key={billboard.category}
          {...billboard}
          isNearby={isNearby(billboard)}
          isSelected={
            isClosest(billboard) && proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE
          }
        />
      ))}

      {/* Interaction UI */}
      <InteractionPrompt
        isVisible={
          proximity.closestBillboard !== null &&
          proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE &&
          !isModalOpen
        }
        category={proximity.closestBillboard?.category ?? 'playing'}
        gameCount={
          proximity.closestBillboard
            ? getGamesByCategory(proximity.closestBillboard.category).length
            : 0
        }
      />

      {/* Billboard Content Modal */}
      <BillboardOverlay
        isVisible={isModalOpen}
        category={selectedCategory}
        games={displayedGames}
        isLoading={isLoading}
        onClose={closeBillboard}
      />
    </>
  );
};
