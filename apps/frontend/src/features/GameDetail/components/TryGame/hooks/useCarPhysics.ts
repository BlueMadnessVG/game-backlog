import { useMemo } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useKeyboardControls } from './useKeyboardControls';
import { DEFAULT_PHYSICS_CONFIG, PHYSICS_CONSTANTS } from '../types/vehicle';
import { createBillboardOBB, resolveCollision } from '../utils/collisionDetection';
import { calculateCarPosition } from '../utils/positionCalculators';
import { calculateNextVehicleState } from '../utils/vehiclePhysics';

import type { BillboardConfig } from '../types/billboard';
import type { VehiclePhysicsConfig } from '../types/vehicle';

interface UseCarPhysicsOptions {
  readonly chassisRef: React.RefObject<THREE.Group | null>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  readonly rotationRef: React.MutableRefObject<number>;
  readonly billboardsConfig: readonly BillboardConfig[];
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
}

/**
 * SRP: owns only the per-frame physics + collision update loop.
 * OCP: new billboard types can be added without touching this hook.
 */
export function useCarPhysics({
  chassisRef,
  sharedSpeedRef,
  rotationRef,
  billboardsConfig,
  physicsConfig = DEFAULT_PHYSICS_CONFIG,
}: UseCarPhysicsOptions): void {
  const keyboardRef = useKeyboardControls();

  const billboardOBBs = useMemo(() => {
    const FRAME_THICKNESS = 0.15;
    const FRAME_DEPTH = 0.1;
    return billboardsConfig.map((config) =>
      createBillboardOBB(config, FRAME_THICKNESS, FRAME_DEPTH),
    );
  }, [billboardsConfig]);

  useFrame((_, delta) => {
    const chassis = chassisRef.current;
    const controls = keyboardRef.current;
    if (!chassis || !controls) return;

    const safeDelta = Math.min(delta, PHYSICS_CONSTANTS.MAX_DELTA_TIME);

    // ── 1. Update velocity & steering ────────────────────────────────────
    const { speed, steeringAngle } = calculateNextVehicleState(
      sharedSpeedRef.current,
      controls,
      physicsConfig,
      safeDelta,
    );

    sharedSpeedRef.current = speed;
    rotationRef.current += steeringAngle * safeDelta;
    chassis.rotation.y = rotationRef.current;

    // ── 2. Tentative position ─────────────────────────────────────────────
    const tentativePosition = calculateCarPosition(
      chassis.position,
      rotationRef.current,
      speed,
      safeDelta,
    );

    chassis.position.copy(tentativePosition);
    chassis.updateMatrixWorld();

    // ── 3. MTV collision resolution ───────────────────────────────────────
    let collisionDetected = false;

    for (const obb of billboardOBBs) {
      const resolvedPosition = resolveCollision(chassis, obb);

      if (!resolvedPosition.equals(chassis.position)) {
        chassis.position.copy(resolvedPosition);
        collisionDetected = true;
      }
    }

    // ── 4. Bounce back on collision ───────────────────────────────────────
    if (collisionDetected) {
      const BOUNCE_FACTOR = 0.2;

      if (sharedSpeedRef.current > 0) {
        sharedSpeedRef.current = -physicsConfig.maxSpeed * BOUNCE_FACTOR;
      } else if (sharedSpeedRef.current < 0) {
        sharedSpeedRef.current = physicsConfig.maxSpeed * BOUNCE_FACTOR;
      } else {
        sharedSpeedRef.current = 0;
      }

      chassis.updateMatrixWorld();
    }
  });
}
