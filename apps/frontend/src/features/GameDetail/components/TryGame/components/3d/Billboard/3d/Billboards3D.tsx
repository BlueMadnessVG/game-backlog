// components/3d/Billboard/3d/Billboards3D.tsx
import React, { useCallback, useRef, useEffect } from 'react';

import * as THREE from 'three';

import { preloadArcadeCabinet } from './ArcadeCabinate/ArcadeCabinetMesh';
import { Billboard } from './BillboardMesh';
import {
  useBillboardInteraction,
  useBillboardProximity,
} from '../../../../hooks/useBillboardProximity';
import { useGamesByCategory } from '../../../../hooks/useGamesByCategory';
import { BILLBOARD_INTERACTION_DISTANCE } from '../../../../types/billboard';

import type { BillboardConfig } from '../../../../types/billboard';

/**
 * Billboard positions and dimensions.
 *
 * "playing" uses the arcade cabinet model (~1.8 m tall, ~0.85 m wide).
 * Its position.y = 0 places the cabinet base on the ground — the GLTF
 * is exported with the bottom at y=0 in local space.
 * width/height are kept for collision OBB calculations in collisionDetection.ts;
 * the arcade cabinet overrides the visual representation entirely.
 *
 * "completed" and "backlog" remain as flat panels at y=3 (vertical centre
 * of a 6-unit-tall panel sitting on the ground).
 */
const DEFAULT_BILLBOARDS: readonly BillboardConfig[] = [
  {
    position: [-20, 0, -15], // cabinet base on ground
    width: 0.85, // matches COLLISION_SIZE[0] in ArcadeCabinetMesh
    height: 1.9, // matches COLLISION_SIZE[1]
    rotation: [0, -Math.PI / 8, 0],
    category: 'playing',
  },
  {
    position: [20, 3, -15], // flat panel centred at y=3
    width: 8,
    height: 6,
    rotation: [0, Math.PI / 8, 0],
    category: 'completed',
  },
  {
    position: [0, 3, 30],
    width: 8,
    height: 6,
    rotation: [0, 0, 0],
    category: 'backlog',
  },
];

// Preload the arcade cabinet GLTF at module load time so it is ready
// before the user drives toward it.
preloadArcadeCabinet();

interface Billboards3DProps {
  readonly carPositionRef: React.RefObject<THREE.Group | null>;
}

export const Billboards3D: React.FC<Billboards3DProps> = ({ carPositionRef }) => {
  const { isLoading, getGamesByCategory } = useGamesByCategory();
  const { selectedCategory, isModalOpen, openBillboard, closeBillboard } =
    useBillboardInteraction('playing');
  const proximity = useBillboardProximity(carPositionRef, DEFAULT_BILLBOARDS);
  const keyHandledRef = useRef(false);

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
        const gamesList = getGamesByCategory(billboard.category);
        const selected =
          isClosest(billboard) && proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE;
        const open = isModalOpen && selectedCategory === billboard.category;

        return (
          <Billboard
            key={billboard.category}
            {...billboard}
            isNearby={isNearby(billboard)}
            isSelected={selected}
            games={gamesList}
            isLoading={isLoading}
            isOpen={open}
            onOpen={() => openBillboard(billboard.category)}
            onClose={closeBillboard}
            showPrompt={selected}
          />
        );
      })}
    </>
  );
};
