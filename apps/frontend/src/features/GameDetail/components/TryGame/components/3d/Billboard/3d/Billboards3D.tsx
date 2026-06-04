// components/3d/Billboard/3d/Billboards3D.tsx
import React, { useCallback, useRef, useEffect, useMemo } from 'react';

import * as THREE from 'three';

import { preloadArcadeCabinet } from './ArcadeCabinate/ArcadeCabinetMesh';
import { Billboard } from './BillboardMesh';
import {
  useBillboardInteraction,
  useBillboardProximity,
} from '../../../../hooks/useBillboardProximity';
import { useGamesByCategory } from '../../../../hooks/useGamesByCategory';
import { BILLBOARD_INTERACTION_DISTANCE } from '../../../../types/billboard';
import { ARCADE_CAMERA_LOCAL } from '../../../../types/camera';

import type { CameraModeControls } from '../../../../hooks/useCameraMode';
import type { BillboardConfig } from '../../../../types/billboard';

/**
 * Billboard layout.
 *
 * 'playing' uses the arcade cabinet (ArcadeCabinetMesh).
 *   position.y = 0  → cabinet base sits on the ground plane
 *   width/height    → used for collision OBB only, not visual size
 *
 * 'completed' / 'backlog' remain as flat panels.
 *   position.y = 3  → vertical centre of a 6-unit-tall panel
 */
const DEFAULT_BILLBOARDS: readonly BillboardConfig[] = [
  {
    position: [-20, 0, -15],
    width: 0.85,
    height: 1.9,
    rotation: [0, -Math.PI / 8, 0],
    category: 'playing',
  },
  {
    position: [20, 3, -15],
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

preloadArcadeCabinet();

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Computes the world-space arcade camera pose for a given billboard.
 *
 * Both the eye position and the screen lookAt point are defined as local
 * offsets in ARCADE_CAMERA_LOCAL.  We rotate those offsets by the
 * billboard's Y rotation and add the billboard's world position.
 *
 * Only called for the 'playing' category — other categories don't zoom.
 */
function computeArcadePose(billboard: BillboardConfig) {
  const yRot = (billboard.rotation as [number, number, number])[1];
  const rotMatrix = new THREE.Matrix4().makeRotationY(yRot);

  const eye = ARCADE_CAMERA_LOCAL.eyeOffset.clone().applyMatrix4(rotMatrix);
  const screen = ARCADE_CAMERA_LOCAL.screenOffset.clone().applyMatrix4(rotMatrix);

  const origin = new THREE.Vector3(...(billboard.position as [number, number, number]));

  return {
    position: eye.add(origin),
    lookAt: screen.add(origin),
  };
}

// ── Component ─────────────────────────────────────────────────────────────

interface Billboards3DProps {
  readonly carPositionRef: React.RefObject<THREE.Group | null>;
  /**
   * Camera mode controls from useCameraMode (created in the parent scene).
   * Pass this so the billboard can trigger the zoom-in when E is pressed
   * and zoom-out when the screen is closed.
   */
  readonly cameraControls?: CameraModeControls;
}

export const Billboards3D: React.FC<Billboards3DProps> = ({ carPositionRef, cameraControls }) => {
  const { isLoading, getGamesByCategory } = useGamesByCategory();
  const { selectedCategory, isModalOpen, openBillboard, closeBillboard } =
    useBillboardInteraction('playing');
  const proximity = useBillboardProximity(carPositionRef, DEFAULT_BILLBOARDS);
  const keyHandledRef = useRef(false);

  // Pre-compute arcade poses for all billboards — stable across renders
  const arcadePoses = useMemo(
    () => Object.fromEntries(DEFAULT_BILLBOARDS.map((b) => [b.category, computeArcadePose(b)])),
    [],
  );

  // ── Interaction key handler ──────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (
        (e.key.toLowerCase() === 'e' || e.key === 'Enter') &&
        proximity.closestBillboard &&
        proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE &&
        !isModalOpen &&
        !keyHandledRef.current
      ) {
        const billboard = proximity.closestBillboard;
        openBillboard(billboard.category);

        // Trigger camera zoom only for the arcade cabinet ('playing')
        if (billboard.category === 'playing' && cameraControls) {
          cameraControls.openArcade(arcadePoses[billboard.category]);
        }

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
  }, [proximity, isModalOpen, openBillboard, cameraControls, arcadePoses]);

  // ── Close handler — also triggers zoom out ───────────────────────────
  const handleClose = useCallback(() => {
    closeBillboard();
    cameraControls?.closeArcade();
  }, [closeBillboard, cameraControls]);

  // ── Proximity helpers ────────────────────────────────────────────────
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
            onOpen={() => {
              openBillboard(billboard.category);
              if (billboard.category === 'playing' && cameraControls) {
                cameraControls.openArcade(arcadePoses[billboard.category]);
              }
            }}
            onClose={handleClose}
            showPrompt={selected}
          />
        );
      })}
    </>
  );
};
