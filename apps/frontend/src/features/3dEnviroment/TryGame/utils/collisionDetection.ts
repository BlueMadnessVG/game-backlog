import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

import type { ColliderConfig } from '../types/collider';

// ── Scratch objects — reused every frame to avoid GC pressure ─────────────

const _rotMatrix4 = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _quaternion = new THREE.Quaternion();
const _distVec = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _bestAxis = new THREE.Vector3();
const _pushVec = new THREE.Vector3();
const _carPosition = new THREE.Vector3();

// Car half-extents — these match the chassis group's BoxGeometry (1.6 × 0.6 × 3)
const CAR_HALF_EXTENTS = new THREE.Vector3(1.6 / 2, 0.6 / 2, 3 / 2);

// Extra margin added to the push-back vector to prevent micro-overlaps next frame
const SAFETY_BUFFER = 0.05;

// ── OBB factory helpers ───────────────────────────────────────────────────

/**
 * Builds an OBB from a ColliderConfig.
 *
 * Call once at startup (e.g. inside useMemo) — not every frame.
 * The OBB is in world space, matching the config's position and rotation.
 */
export function createColliderOBB(config: ColliderConfig): OBB {
  const center = new THREE.Vector3(...config.position);
  const halfSize = new THREE.Vector3(...config.halfExtents);

  _euler.set(config.rotation[0], config.rotation[1], config.rotation[2]);
  _rotMatrix4.makeRotationFromEuler(_euler);
  const orientation = new THREE.Matrix3().setFromMatrix4(_rotMatrix4);

  return new OBB(center, halfSize, orientation);
}

/**
 * Builds an OBB for the car chassis from its current Three.js Group.
 *
 * Extracts PURE rotation from matrixWorld (no scale contamination).
 * The previous implementation used setFromMatrix4 on the raw matrixWorld,
 * which included scale factors in the top-left 3×3 — making the OBB
 * orientation matrix non-orthogonal and causing missed/wrong collisions.
 */
export function createCarOBB(carGroup: THREE.Group): OBB {
  // Extract world position
  carGroup.getWorldPosition(_carPosition);

  // Extract PURE rotation: decompose → quaternion → clean rotation matrix
  carGroup.matrixWorld.decompose(
    new THREE.Vector3(), // translation (discard)
    _quaternion, // rotation (keep)
    new THREE.Vector3(), // scale (discard)
  );
  _rotMatrix4.makeRotationFromQuaternion(_quaternion);
  const orientation = new THREE.Matrix3().setFromMatrix4(_rotMatrix4);

  return new OBB(_carPosition.clone(), CAR_HALF_EXTENTS.clone(), orientation);
}

// ── Legacy adapter ────────────────────────────────────────────────────────

/**
 * @deprecated Use createColliderOBB with a ColliderConfig instead.
 *
 * Kept for backward compatibility with any code that still passes
 * BillboardConfig + frameThickness + frameDepth directly.
 * New code should build ColliderConfigs in Billboards3D and call
 * createColliderOBB.
 */
export function createBillboardOBB(
  config: {
    position: readonly number[];
    rotation: readonly number[];
    width: number;
    height: number;
  },
  frameThickness: number,
  frameDepth: number,
): OBB {
  const legacyCollider: ColliderConfig = {
    position: [config.position[0], config.position[1], config.position[2]],
    rotation: [config.rotation[0], config.rotation[1], config.rotation[2]],
    halfExtents: [
      (config.width + frameThickness * 2) / 2,
      (config.height + frameThickness * 2) / 2,
      frameDepth / 2,
    ],
    bounceFactor: 0.15,
    label: 'legacy-billboard',
  };
  return createColliderOBB(legacyCollider);
}

// ── MTV collision resolution ───────────────────────────────────────────────

/**
 * Result of a single collision test.
 */
export interface CollisionResult {
  /** Whether the car is currently intersecting this collider. */
  readonly hit: boolean;
  /** New car position after push-back (equals current position if no hit). */
  readonly position: THREE.Vector3;
  /**
   * The bounceFactor of the collider that was hit.
   * Used by useCarPhysics to calculate post-impact speed.
   * 0 when hit = false.
   */
  readonly bounceFactor: number;
}

/**
 * Resolves a collision between the car and one OBB using the
 * Minimum Translation Vector (MTV) algorithm.
 *
 * Steps:
 *   1. Build the car's OBB from its current matrixWorld.
 *   2. Early-exit if no intersection (cheap OBB test).
 *   3. Project the centre-to-centre vector onto each of the collider's
 *      three local axes.
 *   4. Find the axis with the smallest overlap — that is the direction
 *      requiring the least movement to separate the objects.
 *   5. Push the car out along that axis by (overlap + safetyBuffer).
 *
 * Returns a CollisionResult so the caller knows:
 *   - WHETHER a hit occurred (to apply bounce physics)
 *   - WHAT the new car position is
 *   - HOW hard the collider is (bounceFactor for the caller to use)
 *
 * @param carGroup      The car's chassis THREE.Group
 * @param colliderOBB   Pre-built OBB (built once in useMemo, not every frame)
 * @param bounceFactor  From ColliderConfig — passed through to the result
 */
export function resolveCollision(
  carGroup: THREE.Group,
  colliderOBB: OBB,
  bounceFactor: number,
): CollisionResult {
  const carOBB = createCarOBB(carGroup);

  // ── 1. Early exit ─────────────────────────────────────────────────────
  if (!carOBB.intersectsOBB(colliderOBB)) {
    return { hit: false, position: carGroup.position, bounceFactor: 0 };
  }

  // ── 2. Centre-to-centre vector ────────────────────────────────────────
  _distVec.subVectors(carGroup.position, colliderOBB.center);

  // ── 3. Local axes of the collider ─────────────────────────────────────
  const e = colliderOBB.rotation.elements;
  const axes: [THREE.Vector3, number][] = [
    [new THREE.Vector3(e[0], e[1], e[2]), colliderOBB.halfSize.x + CAR_HALF_EXTENTS.x], // X Axis
    [new THREE.Vector3(e[3], e[4], e[5]), colliderOBB.halfSize.y + CAR_HALF_EXTENTS.y], // Y Axis
    [new THREE.Vector3(e[6], e[7], e[8]), colliderOBB.halfSize.z + CAR_HALF_EXTENTS.z], // Z Axis
  ];

  // ── 4. Find the minimum-overlap axis ─────────────────────────────────
  let minOverlap = Infinity;
  _bestAxis.set(0, 0, 1);

  for (const [axisVec, limit] of axes) {
    _axis.copy(axisVec).normalize();
    const projection = _distVec.dot(_axis);
    const overlap = limit - Math.abs(projection);

    if (overlap > 0 && overlap < minOverlap) {
      minOverlap = overlap;
      // Push direction: away from the collider centre along this axis
      _bestAxis.copy(_axis).multiplyScalar(projection >= 0 ? 1 : -1);
    }
  }

  // ── 5. FIX: Flatten the push vector to the ground plane ───────────────
  // This explicitly prevents the MTV algorithm from pushing the car down into the ground floor
  _bestAxis.y = 0;
  _bestAxis.normalize(); // Re-normalize to ensure clean push magnitudes after flattening

  // ── 6. Compute corrected position ─────────────────────────────────────
  _pushVec.copy(_bestAxis).multiplyScalar(minOverlap + SAFETY_BUFFER);

  const correctedPosition = carGroup.position.clone().add(_pushVec);

  // Maintain the vehicle's locked structural height position
  correctedPosition.y = carGroup.position.y;

  return { hit: true, position: correctedPosition, bounceFactor };
}
