import React, { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import { DEFAULT_PHYSICS_CONFIG, PHYSICS_CONSTANTS } from '../../types/vehicle';
import { calculateCarPosition } from '../../utils/positionCalculators';
import { calculateNextVehicleState } from '../../utils/vehiclePhysics';

import type { VehiclePhysicsConfig } from '../../types/vehicle';

interface CarProps {
  readonly sharedRootRef: React.RefObject<THREE.Group | null>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
}

export const Car: React.FC<CarProps> = ({
  sharedRootRef,
  sharedSpeedRef,
  physicsConfig = DEFAULT_PHYSICS_CONFIG,
}) => {
  const keyboardRef = useKeyboardControls();
  const currentRotationRef = useRef<number>(0);

  useFrame((_, delta) => {
    const chassis = sharedRootRef.current;
    const controls = keyboardRef.current;

    if (!chassis || !controls) return;

    const safeDelta = Math.min(delta, PHYSICS_CONSTANTS.MAX_DELTA_TIME);

    const { speed, steeringAngle } = calculateNextVehicleState(
      sharedSpeedRef.current,
      controls,
      physicsConfig,
      safeDelta,
    );

    sharedSpeedRef.current = speed;
    currentRotationRef.current += steeringAngle * safeDelta;
    chassis.rotation.y = currentRotationRef.current;

    const newPosition = calculateCarPosition(
      chassis.position,
      currentRotationRef.current,
      speed,
      safeDelta,
    );

    chassis.position.copy(newPosition);
  });

  return (
    <group ref={sharedRootRef} position={[0, 0.3, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.6, 3]} />
        <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  );
};
