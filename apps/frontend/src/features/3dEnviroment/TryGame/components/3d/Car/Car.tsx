// components/3d/Car.tsx
import React, { useRef } from 'react';

import * as THREE from 'three';

import { CarModel, preloadCarModel } from './CarModel';
import { useCarPhysics } from '../../../hooks/useCarPhysics';
import { DEFAULT_CAR_MODEL_CONFIG } from '../../../types/carModel';
import { DEFAULT_PHYSICS_CONFIG } from '../../../types/vehicle';

import type { CarModelConfig } from '../../../types/carModel';
import type { ColliderConfig } from '../../../types/collider';
import type { CarControls } from '../../../types/input';
import type { VehiclePhysicsConfig } from '../../../types/vehicle';

interface CarProps {
  readonly sharedRootRef: React.RefObject<THREE.Group | null>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  /**
   * World-space collision volumes.
   * Replaces the old billboardsConfig — ColliderConfig is visual-agnostic
   * and works for any static object (billboard, cabinet, wall, pillar).
   */
  readonly colliders: readonly ColliderConfig[];
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
  readonly modelConfig?: Readonly<CarModelConfig>;
  readonly controlsRef: React.RefObject<CarControls>;
}

export const Car: React.FC<CarProps> = ({
  sharedRootRef,
  sharedSpeedRef,
  colliders,
  physicsConfig = DEFAULT_PHYSICS_CONFIG,
  modelConfig = DEFAULT_CAR_MODEL_CONFIG,
  controlsRef,
}) => {
  const rotationRef = useRef<number>(0);

  useCarPhysics({
    chassisRef: sharedRootRef,
    sharedSpeedRef,
    rotationRef,
    colliders,
    physicsConfig,
    controlsRef,
  });

  return (
    <group ref={sharedRootRef} position={[0, 0.3, 0]}>
      <CarModel config={modelConfig} sharedSpeedRef={sharedSpeedRef} controlsRef={controlsRef} />
    </group>
  );
};

preloadCarModel(DEFAULT_CAR_MODEL_CONFIG.url);
