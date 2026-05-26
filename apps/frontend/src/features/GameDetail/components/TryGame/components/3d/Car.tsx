// components/3d/Car.tsx
import React, { useRef, useMemo } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { CollisionBoxHelper } from './debug/CollisionBoxHelper';
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

  // 1. Memorizar las OBB estáticas para optimizar el rendimiento por frame
  const billboardOBBs = useMemo(() => {
    const frameThickness = 0.15;
    const frameDepth = 0.1;

    return billboardsConfig.map((config) => createBillboardOBB(config, frameThickness, frameDepth));
  }, [billboardsConfig]);

  useFrame((_, delta) => {
    const chassis = sharedRootRef.current;
    const controls = keyboardRef.current;

    // Early return estricto si los componentes no están listos
    if (!chassis || !controls) return;

    const safeDelta = Math.min(delta, PHYSICS_CONSTANTS.MAX_DELTA_TIME);

    // 2. Calcular el estado cinemático del vehículo según la entrada del teclado
    const { speed, steeringAngle } = calculateNextVehicleState(
      sharedSpeedRef.current,
      controls,
      physicsConfig,
      safeDelta,
    );

    sharedSpeedRef.current = speed;
    currentRotationRef.current += steeringAngle * safeDelta;
    chassis.rotation.y = currentRotationRef.current;

    // 3. Proyectar la posición tentativa hacia la que se quiere mover el coche
    const tentativePosition = calculateCarPosition(
      chassis.position,
      currentRotationRef.current,
      speed,
      safeDelta,
    );

    // Aplicamos la posición de manera tentativa para evaluar la colisión
    chassis.position.copy(tentativePosition);
    chassis.updateMatrixWorld();

    // 4. Evaluar colisiones iterando sobre las OBBs memorizadas
    let collisionDetected = false;

    for (const obb of billboardOBBs) {
      const resolvedPosition = resolveCollision(chassis, obb);

      // Si la posición devuelta es diferente, hubo intersección y fue expulsado por el buffer
      if (!resolvedPosition.equals(chassis.position)) {
        chassis.position.copy(resolvedPosition);
        collisionDetected = true;
      }
    }

    // 5. SOLUCIÓN AL BUG: Rebote físico controlado para liberar el estado cinemático
    if (collisionDetected) {
      if (sharedSpeedRef.current > 0) {
        // Impacto frontal: Invertimos a una velocidad negativa pequeña (reversa automática)
        // Esto lo despega del anuncio instantáneamente rompiendo el umbral muerto de la física
        sharedSpeedRef.current = -physicsConfig.maxSpeed * 0.15;
      } else if (sharedSpeedRef.current < 0) {
        // Impacto trasero: Pequeño empuje hacia adelante
        sharedSpeedRef.current = physicsConfig.maxSpeed * 0.15;
      } else {
        sharedSpeedRef.current = 0;
      }
    }
  });

  return (
    <group ref={sharedRootRef} position={[0, 0.3, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.6, 3]} />
        <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Caja de asistencia visual de colisión (Debug) */}
      <CollisionBoxHelper
        position={[0, 0, 0]} // Centrado con respecto al chasis
        size={[1.6, 0.6, 3]}
        color="#22c55e" // Verde para el coche
      />
    </group>
  );
};
