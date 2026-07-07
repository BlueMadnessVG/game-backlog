import { useEffect, useState } from 'react';

import * as THREE from 'three';

import { BILLBOARD_INTERACTION_DISTANCE } from '../types/billboard';

import type { BillboardConfig, GameCategory } from '../types/billboard';

interface ProximityResult {
  readonly closestBillboard: BillboardConfig | null;
  readonly closestDistance: number;
  readonly nearbyBillboards: readonly BillboardConfig[];
}

/**
 * Calculates distance between two 3D points
 */
const calculateDistance = (p1: Readonly<[number, number, number]>, p2: THREE.Vector3): number => {
  const dx = p1[0] - p2.x;
  const dy = p1[1] - p2.y;
  const dz = p1[2] - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * Hook for detecting proximity to billboards and tracking interaction state
 */
export const useBillboardProximity = (
  carPositionRef: React.RefObject<THREE.Group | null>,
  billboards: readonly BillboardConfig[],
  interactionDistance: number = BILLBOARD_INTERACTION_DISTANCE,
) => {
  const [proximity, setProximity] = useState<ProximityResult>({
    closestBillboard: null,
    closestDistance: Infinity,
    nearbyBillboards: [],
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const carPos = carPositionRef.current?.position;

      if (!carPos || billboards.length === 0) {
        setProximity({
          closestBillboard: null,
          closestDistance: Infinity,
          nearbyBillboards: [],
        });
        return;
      }

      let closestBillboard: BillboardConfig | null = null;
      let closestDistance = Infinity;
      const nearbyBillboards: BillboardConfig[] = [];

      billboards.forEach((billboard) => {
        const distance = calculateDistance(billboard.position, carPos);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestBillboard = billboard;
        }

        if (distance < interactionDistance) {
          nearbyBillboards.push(billboard);
        }
      });

      setProximity({
        closestBillboard,
        closestDistance,
        nearbyBillboards,
      });
    }, 100); // Update every 100ms for smooth detection

    return () => clearInterval(interval);
  }, [carPositionRef, billboards, interactionDistance]);

  return proximity;
};

/**
 * Hook for managing billboard interaction state
 */
export const useBillboardInteraction = (initialCategory: GameCategory = 'playing') => {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>(initialCategory);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openBillboard = (category: GameCategory) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const closeBillboard = () => {
    setIsModalOpen(false);
  };

  return {
    selectedCategory,
    isModalOpen,
    openBillboard,
    closeBillboard,
  };
};
