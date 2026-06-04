// components/3d/Car.tsx
import React, { useRef } from 'react';

import * as THREE from 'three';

import { CarModel, preloadCarModel } from './CarModel';
import { useCarPhysics } from '../../../hooks/useCarPhysics';
import { DEFAULT_CAR_MODEL_CONFIG } from '../../../types/carModel';
import { DEFAULT_PHYSICS_CONFIG } from '../../../types/vehicle';

import type { BillboardConfig } from '../../../types/billboard';
import type { CarModelConfig } from '../../../types/carModel';
import type { CarControls } from '../../../types/input';
import type { VehiclePhysicsConfig } from '../../../types/vehicle';

interface CarProps {
  readonly sharedRootRef: React.RefObject<THREE.Group | null>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  readonly billboardsConfig: readonly BillboardConfig[];
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
  readonly modelConfig?: Readonly<CarModelConfig>;
  /**
   * Controls ref from useInputRouter.
   *
   * When the player enters the arcade, useInputRouter sets all fields to
   * false — the car receives no throttle/steer input and coasts to a stop
   * via its normal exponential friction.  No special physics change needed.
   *
   * Previously Car called useKeyboardControls() internally. Moving the ref
   * to a prop (DIP) lets the parent own the input lifecycle and swap it
   * without touching the physics layer.
   */
  readonly controlsRef: React.RefObject<CarControls>;
}

export const Car: React.FC<CarProps> = ({
  sharedRootRef,
  sharedSpeedRef,
  billboardsConfig,
  physicsConfig = DEFAULT_PHYSICS_CONFIG,
  modelConfig = DEFAULT_CAR_MODEL_CONFIG,
  controlsRef,
}) => {
  const rotationRef = useRef<number>(0);

  useCarPhysics({
    chassisRef: sharedRootRef,
    sharedSpeedRef,
    rotationRef,
    billboardsConfig,
    physicsConfig,
    controlsRef, // ← passed through to physics, no internal hook needed
  });

  return (
    <group ref={sharedRootRef} position={[0, 0.3, 0]}>
      <CarModel config={modelConfig} sharedSpeedRef={sharedSpeedRef} controlsRef={controlsRef} />
    </group>
  );
};

preloadCarModel(DEFAULT_CAR_MODEL_CONFIG.url);
