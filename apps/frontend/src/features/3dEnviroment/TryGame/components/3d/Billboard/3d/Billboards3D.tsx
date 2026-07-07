// components/3d/Billboard/3d/Billboards3D.tsx
import React, { useCallback, useRef, useEffect, useMemo } from 'react';

import * as THREE from 'three';

import { preloadArcadeCabinet } from './ArcadeCabinate/ArcadeCabinetMesh';
import { Billboard } from './BillboardMesh';
import { preloadTrophyCase } from './TrophyCase/TrophyCaseMesh';
import {
  useBillboardInteraction,
  useBillboardProximity,
} from '../../../../hooks/useBillboardProximity';
import { useGamesByCategory } from '../../../../hooks/useGamesByCategory';
import { BILLBOARD_INTERACTION_DISTANCE } from '../../../../types/billboard';
import { ARCADE_CAMERA_LOCAL, TROPHY_CASE_CAMERA_LOCAL } from '../../../../types/camera';

import type { CameraModeControls } from '../../../../hooks/useCameraMode';
import type { BillboardConfig } from '../../../../types/billboard';
import type { ArcadeControls } from '../../../../types/input';

const DEFAULT_BILLBOARDS: readonly BillboardConfig[] = [
  {
    position: [-20, 0, -15],
    width: 0.85,
    height: 1.9,
    rotation: [0, -Math.PI / 8, 0],
    category: 'playing',
  },
  {
    position: [20, 2, -15],
    width: 0.85,
    height: 1.9,
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
preloadTrophyCase();

// ── Pose calculators ──────────────────────────────────────────────────────────

/**
 * Shared pose calculator — rotates local offsets by the billboard's Y rotation
 * then adds the billboard's world position.
 */
function computePose(
  billboard: BillboardConfig,
  eyeOffset: THREE.Vector3,
  screenOffset: THREE.Vector3,
) {
  const yRot = (billboard.rotation as [number, number, number])[1];
  const rotMatrix = new THREE.Matrix4().makeRotationY(yRot);
  const origin = new THREE.Vector3(...(billboard.position as [number, number, number]));

  return {
    position: eyeOffset.clone().applyMatrix4(rotMatrix).add(origin),
    lookAt: screenOffset.clone().applyMatrix4(rotMatrix).add(origin),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Billboards3DProps {
  readonly carPositionRef: React.RefObject<THREE.Group | null>;
  readonly cameraControls?: CameraModeControls;
  readonly arcadeControlsRef: React.RefObject<ArcadeControls>;
}

export const Billboards3D: React.FC<Billboards3DProps> = ({
  carPositionRef,
  cameraControls,
  arcadeControlsRef,
}) => {
  const { isLoading, getGamesByCategory } = useGamesByCategory();
  const { selectedCategory, isModalOpen, openBillboard, closeBillboard } =
    useBillboardInteraction('playing');
  const proximity = useBillboardProximity(carPositionRef, DEFAULT_BILLBOARDS);
  const keyHandledRef = useRef(false);

  const poses = useMemo(
    () => ({
      playing: computePose(
        DEFAULT_BILLBOARDS.find((b) => b.category === 'playing')!,
        ARCADE_CAMERA_LOCAL.eyeOffset,
        ARCADE_CAMERA_LOCAL.screenOffset,
      ),
      completed: computePose(
        DEFAULT_BILLBOARDS.find((b) => b.category === 'completed')!,
        TROPHY_CASE_CAMERA_LOCAL.eyeOffset,
        TROPHY_CASE_CAMERA_LOCAL.screenOffset,
      ),
    }),
    [],
  );

  // ── Key handler ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (
        (e.key.toLowerCase() === 'e' || e.key === 'Enter') &&
        proximity.closestBillboard &&
        proximity.closestDistance < BILLBOARD_INTERACTION_DISTANCE &&
        !isModalOpen &&
        !keyHandledRef.current
      ) {
        const { category } = proximity.closestBillboard;
        openBillboard(category);

        // Trigger camera zoom for structures that have a pose defined
        if (cameraControls) {
          if (category === 'playing') cameraControls.openArcade(poses.playing);
          if (category === 'completed') cameraControls.openArcade(poses.completed);
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
  }, [proximity, isModalOpen, openBillboard, cameraControls, poses]);

  const handleClose = useCallback(() => {
    closeBillboard();
    cameraControls?.closeArcade();
  }, [closeBillboard, cameraControls]);

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
              if (cameraControls) {
                if (billboard.category === 'playing') cameraControls.openArcade(poses.playing);
                if (billboard.category === 'completed') cameraControls.openArcade(poses.completed);
              }
            }}
            onClose={handleClose}
            showPrompt={selected}
            arcadeControlsRef={arcadeControlsRef}
          />
        );
      })}
    </>
  );
};
