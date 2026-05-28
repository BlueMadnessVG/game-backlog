// components/3d/Car.tsx
import React, { useRef, useMemo } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import { DEFAULT_PHYSICS_CONFIG, PHYSICS_CONSTANTS } from '../../types/vehicle';
import { createBillboardOBB, resolveCollision } from '../../utils/collisionDetection';
import { calculateCarPosition } from '../../utils/positionCalculators';
import { calculateNextVehicleState } from '../../utils/vehiclePhysics';

import type { BillboardConfig } from '../../types/billboard';
import type { VehiclePhysicsConfig } from '../../types/vehicle';

interface CarProps {
  readonly sharedRootRef: React.RefObject<THREE.Group | null>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  readonly billboardsConfig: readonly BillboardConfig[];
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
}

export const Car: React.FC<CarProps> = ({
  sharedRootRef,
  sharedSpeedRef,
  billboardsConfig,
  physicsConfig = DEFAULT_PHYSICS_CONFIG,
}) => {
  const keyboardRef = useKeyboardControls();
  const currentRotationRef = useRef<number>(0);

  const billboardOBBs = useMemo(() => {
    const frameThickness = 0.15;
    const frameDepth = 0.1;
    return billboardsConfig.map((config) => createBillboardOBB(config, frameThickness, frameDepth));
  }, [billboardsConfig]);

  useFrame((_, delta) => {
    const chassis = sharedRootRef.current;
    const controls = keyboardRef.current;

    if (!chassis || !controls) return;

    const safeDelta = Math.min(delta, PHYSICS_CONSTANTS.MAX_DELTA_TIME);

    // 1. Obtener físicas del teclado
    const { speed, steeringAngle } = calculateNextVehicleState(
      sharedSpeedRef.current,
      controls,
      physicsConfig,
      safeDelta,
    );

    sharedSpeedRef.current = speed;
    currentRotationRef.current += steeringAngle * safeDelta;
    chassis.rotation.y = currentRotationRef.current;

    // 2. Mover temporalmente a la posición proyectada
    const tentativePosition = calculateCarPosition(
      chassis.position,
      currentRotationRef.current,
      speed,
      safeDelta,
    );

    chassis.position.copy(tentativePosition);
    chassis.updateMatrixWorld();

    // 3. Resolver colisión usando el algoritmo MTV (Eje de separación)
    let collisionDetected = false;

    for (const obb of billboardOBBs) {
      const resolvedPosition = resolveCollision(chassis, obb);

      if (!resolvedPosition.equals(chassis.position)) {
        chassis.position.copy(resolvedPosition);
        collisionDetected = true;
      }
    }

    // 4. Romper el enganche magnético: Invertimos y penalizamos la inercia drásticamente
    if (collisionDetected) {
      if (sharedSpeedRef.current > 0) {
        // Detiene el avance y le da un pequeño empuje de despegue inverso hacia atrás
        sharedSpeedRef.current = -physicsConfig.maxSpeed * 0.2;
      } else if (sharedSpeedRef.current < 0) {
        // Empuje hacia adelante si chocó retrocediendo
        sharedSpeedRef.current = physicsConfig.maxSpeed * 0.2;
      } else {
        sharedSpeedRef.current = 0;
      }

      // Forzar actualización final de la matriz para que el renderer sepa el despegue exacto
      chassis.updateMatrixWorld();
    }
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
