// components/3d/Car.tsx
import React, { useRef } from 'react';

import * as THREE from 'three';

import { CarModel, preloadCarModel } from './CarModel';
import { useCarPhysics } from '../../../hooks/useCarPhysics';
import { useKeyboardControls } from '../../../hooks/useKeyboardControls';
import { DEFAULT_CAR_MODEL_CONFIG } from '../../../types/carModel';
import { DEFAULT_PHYSICS_CONFIG } from '../../../types/vehicle';

import type { BillboardConfig } from '../../../types/billboard';
import type { CarModelConfig } from '../../../types/carModel';
import type { VehiclePhysicsConfig } from '../../../types/vehicle';

interface CarProps {
  readonly sharedRootRef: React.RefObject<THREE.Group | null>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  readonly billboardsConfig: readonly BillboardConfig[];
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
  readonly modelConfig?: Readonly<CarModelConfig>;
}

export const Car: React.FC<CarProps> = ({
  sharedRootRef,
  sharedSpeedRef,
  billboardsConfig,
  physicsConfig = DEFAULT_PHYSICS_CONFIG,
  modelConfig = DEFAULT_CAR_MODEL_CONFIG,
}) => {
  const rotationRef = useRef<number>(0);

  // Resolve input tracking reference
  const controlsRef = useKeyboardControls();

  // Layer 1: Rigidbody Physics and Collisions processing loop
  useCarPhysics({
    chassisRef: sharedRootRef,
    sharedSpeedRef,
    rotationRef,
    billboardsConfig,
    physicsConfig,
  });

  return (
    <group ref={sharedRootRef} position={[0, 0.3, 0]}>
      {/* Layer 2: Render Component with loose references passing (DIP compliant) */}
      <CarModel config={modelConfig} sharedSpeedRef={sharedSpeedRef} controlsRef={controlsRef} />
    </group>
  );
};

preloadCarModel(DEFAULT_CAR_MODEL_CONFIG.url);
