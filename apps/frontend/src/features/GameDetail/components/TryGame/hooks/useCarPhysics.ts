import { useMemo } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

import { DEFAULT_PHYSICS_CONFIG, PHYSICS_CONSTANTS } from '../types/vehicle';
import { createColliderOBB, resolveCollision } from '../utils/collisionDetection';
import { calculateCarPosition } from '../utils/positionCalculators';
import { calculateNextVehicleState } from '../utils/vehiclePhysics';

import type { ColliderConfig } from '../types/collider';
import type { CarControls } from '../types/input';
import type { VehiclePhysicsConfig } from '../types/vehicle';

interface UseCarPhysicsOptions {
  readonly chassisRef: React.RefObject<THREE.Group | null>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  readonly rotationRef: React.MutableRefObject<number>;
  /**
   * World-space collision volumes for all static objects in the scene.
   *
   * Built once at startup from ColliderConfig (not from BillboardConfig).
   * Each entry carries its own bounceFactor so the physics response is
   * tuned per-object — the arcade cabinet bounces harder than a flat sign.
   */
  readonly colliders: readonly ColliderConfig[];
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
  readonly controlsRef: React.RefObject<CarControls>;
}

export function useCarPhysics({
  chassisRef,
  sharedSpeedRef,
  rotationRef,
  colliders,
  physicsConfig = DEFAULT_PHYSICS_CONFIG,
  controlsRef,
}: UseCarPhysicsOptions): void {
  // Pre-build OBBs once — cheaper than rebuilding every frame
  const colliderOBBs = useMemo<{ obb: OBB; bounceFactor: number }[]>(
    () => colliders.map((c) => ({ obb: createColliderOBB(c), bounceFactor: c.bounceFactor })),
    [colliders],
  );

  useFrame((_, delta) => {
    const chassis = chassisRef.current;
    const controls = controlsRef.current;
    if (!chassis || !controls) return;

    const safeDelta = Math.min(delta, PHYSICS_CONSTANTS.MAX_DELTA_TIME);

    // ── 1. Velocity & steering ────────────────────────────────────────────
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

    // ── 3. Collision resolution ───────────────────────────────────────────
    // Accumulate the highest bounceFactor across all hit colliders this frame.
    // Using the max (rather than first-hit) gives correct behaviour when the
    // car clips two objects simultaneously (e.g. corner of cabinet + wall).
    let maxBounceFactor = 0;
    let anyHit = false;

    for (const { obb, bounceFactor } of colliderOBBs) {
      const result = resolveCollision(chassis, obb, bounceFactor);

      if (result.hit) {
        chassis.position.copy(result.position);
        chassis.updateMatrixWorld();
        anyHit = true;
        if (result.bounceFactor > maxBounceFactor) {
          maxBounceFactor = result.bounceFactor;
        }
      }
    }

    // ── 4. Apply bounce ───────────────────────────────────────────────────
    // Speed after impact = -currentSpeed × bounceFactor
    //   bounceFactor 0.4 (arcade cabinet): noticeable rebound
    //   bounceFactor 0.15 (flat panel):    gentle push-back
    // The negative sign reverses direction; the factor scales the magnitude.
    if (anyHit && maxBounceFactor > 0) {
      sharedSpeedRef.current = -sharedSpeedRef.current * maxBounceFactor;
      chassis.updateMatrixWorld();
    }
  });
}
