// utils/positionCalculators.ts
import * as THREE from 'three';

/**
 * Pre-allocated constants — avoids per-frame heap allocations.
 *
 * Coordinate convention (this project):
 *   Physics forward = local +Z
 *   Positive speed  → car moves in +Z direction (forward / W key)
 *   Negative speed  → car moves in −Z direction (reverse / S key)
 *
 * This matches the camera config where offset.z = −11 sits BEHIND
 * the car, confirming that +Z is the forward direction here.
 */
const LOCAL_FORWARD = Object.freeze(new THREE.Vector3(0, 0, 1));
const Y_AXIS = Object.freeze(new THREE.Vector3(0, 1, 0));

// Scratch vectors — mutated each frame, never exposed outside this module.
const _forward = new THREE.Vector3();
const _movement = new THREE.Vector3();

/**
 * Returns the new world position of the car chassis after one physics step.
 *
 * Steps:
 *   1. Start with local forward (0, 0, +1).
 *   2. Rotate it by `currentRotation` around Y → world-space forward vector.
 *   3. Scale by speed × dt → displacement this frame.
 *   4. Add to current position.
 *
 * No heap allocation — scratch vectors are reused every call.
 *
 * @param currentPosition  Car's current world position (not mutated).
 * @param currentRotation  Car's current Y-axis rotation in radians.
 * @param speed            Signed speed in m/s (positive = forward).
 * @param deltaTime        Frame delta in seconds (already clamped by caller).
 */
export const calculateCarPosition = (
  currentPosition: Readonly<THREE.Vector3>,
  currentRotation: number,
  speed: number,
  deltaTime: number,
): THREE.Vector3 => {
  // 1. Copy the local forward direction into scratch vector
  _forward.copy(LOCAL_FORWARD);

  // 2. Rotate it to match the chassis yaw — applyAxisAngle is in-place,
  //    using the frozen Y_AXIS as the axis (safe: applyAxisAngle reads axis, doesn't write it)
  _forward.applyAxisAngle(Y_AXIS as THREE.Vector3, currentRotation);

  // 3. Scale by displacement this frame
  _movement.copy(_forward).multiplyScalar(speed * deltaTime);

  // 4. Return new position (clone so caller owns the result)
  return new THREE.Vector3().addVectors(currentPosition as THREE.Vector3, _movement);
};
