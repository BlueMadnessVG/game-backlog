// utils/cameraCalculators.ts
import * as THREE from 'three';

import type { CameraFollowConfig } from '../types/camera';

// ── Guards ────────────────────────────────────────────────────────────────

const isSafeNumber = (value: unknown): value is number =>
  typeof value === 'number' && isFinite(value);

const clampLerpFactor = (factor: number): number => Math.max(0, Math.min(factor, 10));

// ── Calculators ───────────────────────────────────────────────────────────

/**
 * Returns the ideal camera position in world space.
 *
 * Speed zoom: as the car goes faster the camera pulls further back (+z)
 * and slightly higher (+y) so the player can see ahead.
 *
 * Local-space axis reminder (see types/camera.ts):
 *   +z in local space = BEHIND the car
 * So adding to z here correctly increases distance behind at speed.
 */
export const calculateIdealCameraPosition = (
  targetMatrixWorld: THREE.Matrix4,
  speed: number,
  config: Readonly<CameraFollowConfig>,
): THREE.Vector3 => {
  if (!isSafeNumber(speed)) return new THREE.Vector3();

  const offset = config.offset.clone();

  const zoomAmount = Math.abs(speed) * config.speedZoomFactor;
  offset.z += zoomAmount; // pull further back at speed
  offset.y += zoomAmount * 0.5; // rise slightly at speed

  offset.applyMatrix4(targetMatrixWorld);

  return offset;
};

/**
 * Returns the ideal look-at point in world space.
 * lookAtOffset.z is negative (ahead of the car) so the camera
 * always stares toward where the car is heading.
 */
export const calculateIdealLookAtPosition = (
  targetMatrixWorld: THREE.Matrix4,
  config: Readonly<CameraFollowConfig>,
): THREE.Vector3 => {
  const lookAt = config.lookAtOffset.clone();
  lookAt.applyMatrix4(targetMatrixWorld);
  return lookAt;
};

// ── Lerp helpers ──────────────────────────────────────────────────────────

export const lerpCameraPosition = (
  current: THREE.Vector3,
  target: THREE.Vector3,
  factor: number,
  deltaTime: number,
): THREE.Vector3 => {
  const t = clampLerpFactor(factor) * deltaTime;
  return current.lerp(target, t);
};

export const lerpCameraLookAt = (
  current: THREE.Vector3,
  target: THREE.Vector3,
  factor: number,
  deltaTime: number,
): THREE.Vector3 => {
  const t = clampLerpFactor(factor) * deltaTime;
  return current.lerp(target, t);
};
