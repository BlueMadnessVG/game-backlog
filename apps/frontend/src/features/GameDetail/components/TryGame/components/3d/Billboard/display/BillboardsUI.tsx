// components/3d/Billboard/display/BillboardsUI.tsx
import React from 'react';

import * as THREE from 'three';

import { BillboardOverlay } from './BillboardOverlay';
import { useBillboardInteraction } from '../../../../hooks/useBillboardProximity';
import { useGamesByCategory } from '../../../../hooks/useGamesByCategory';

interface BillboardsUIProps {
  readonly carPositionRef: React.RefObject<THREE.Group | null>;
}

export const BillboardsUI: React.FC<BillboardsUIProps> = () => {
  const { isLoading, getGamesByCategory } = useGamesByCategory();
  const { selectedCategory, isModalOpen, closeBillboard } = useBillboardInteraction('playing');

  const displayedGames = getGamesByCategory(selectedCategory);

  return (
    <>
      {/* Standard Full-Viewport Modal Context for detailed inspection */}
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
