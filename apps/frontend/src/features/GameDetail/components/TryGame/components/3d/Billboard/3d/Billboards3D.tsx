// components/3d/Billboard/3d/Billboards3D.tsx
import React, { useCallback, useRef, useEffect } from 'react';

import * as THREE from 'three';

import { Billboard } from './BillboardMesh';
import {
  useBillboardInteraction,
  useBillboardProximity,
} from '../../../../hooks/useBillboardProximity';
import { useGamesByCategory } from '../../../../hooks/useGamesByCategory';
import { BILLBOARD_INTERACTION_DISTANCE } from '../../../../types/billboard';

import type { BillboardConfig } from '../../../../types/billboard';
import type { Game } from '@repo/shared';

interface Billboards3DProps {
  readonly carPositionRef: React.RefObject<THREE.Group | null>;
  readonly gamesByCategory?: {
    playing: readonly Game[];
    completed: readonly Game[];
    backlog: readonly Game[];
  };
}

const DEFAULT_BILLBOARDS: readonly BillboardConfig[] = [
  {
    position: [-20, 0, -15],
    width: 8,
    height: 6,
    rotation: [0, -Math.PI / 8, 0],
    category: 'playing',
  },
  {
    position: [20, 0, -15],
    width: 8,
    height: 6,
    rotation: [0, Math.PI / 8, 0],
    category: 'completed',
  },
  { position: [0, 0, 30], width: 8, height: 6, rotation: [0, 0, 0], category: 'backlog' },
];

export const Billboards3D: React.FC<Billboards3DProps> = ({ carPositionRef }) => {
  const { isLoading, getGamesByCategory } = useGamesByCategory();
  const { selectedCategory, isModalOpen, openBillboard, closeBillboard } =
    useBillboardInteraction('playing');
  const proximity = useBillboardProximity(carPositionRef, DEFAULT_BILLBOARDS);
  const keyHandledRef = useRef(false);

  // E / Enter → open closest billboard
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (
        (e.key.toLowerCase() === 'e' || e.key === 'Enter') &&
        proximity.closestBillboard &&
        proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE &&
        !isModalOpen &&
        !keyHandledRef.current
      ) {
        openBillboard(proximity.closestBillboard.category);
        keyHandledRef.current = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' || e.key === 'Enter') keyHandledRef.current = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [proximity, isModalOpen, openBillboard]);

  const isNearby = useCallback(
    (b: BillboardConfig) => proximity.nearbyBillboards.some((n) => n.category === b.category),
    [proximity.nearbyBillboards],
  );
  const isClosest = useCallback(
    (b: BillboardConfig) => proximity.closestBillboard?.category === b.category,
    [proximity.closestBillboard],
  );

  return (
    <>
      {DEFAULT_BILLBOARDS.map((billboard) => {
        const selected =
          isClosest(billboard) && proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE;
        const open = isModalOpen && selectedCategory === billboard.category;
        return (
          <Billboard
            key={billboard.category}
            {...billboard}
            isNearby={isNearby(billboard)}
            isSelected={selected}
            games={getGamesByCategory(billboard.category)}
            isLoading={isLoading}
            isOpen={open}
            onOpen={() => openBillboard(billboard.category)}
            onClose={closeBillboard}
          />
        );
      })}
    </>
  );
};
