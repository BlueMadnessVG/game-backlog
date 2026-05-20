import * as THREE from 'three';

import type { CameraFollowConfig } from '../types/camera';

const isSafeNumber = (value: unknown): boolean => {
  return typeof value === 'number' && isFinite(value);
};

const clampLerpFactor = (factor: number): number => {
  return Math.max(0, Math.min(factor, 10));
};

export const calculateIdealCameraPosition = (
  targetMatrixWorld: THREE.Matrix4,
  speed: number,
  config: Readonly<CameraFollowConfig>,
): THREE.Vector3 => {
  if (!isSafeNumber(speed)) return new THREE.Vector3();

  const offset = config.offset.clone();

  const zoomBackAmount = Math.abs(speed) * config.speedZoomFactor;
  offset.z -= zoomBackAmount;
  offset.y += zoomBackAmount * 0.5;

  offset.applyMatrix4(targetMatrixWorld);

  return offset;
};

export const calculateIdealLookAtPosition = (
  targetMatrixWorld: THREE.Matrix4,
  config: Readonly<CameraFollowConfig>,
): THREE.Vector3 => {
  const lookAt = config.lookAtOffset.clone();
  lookAt.applyMatrix4(targetMatrixWorld);

  return lookAt;
};

export const lerpCameraPosition = (
  current: THREE.Vector3,
  target: THREE.Vector3,
  factor: number,
  deltaTime: number,
): THREE.Vector3 => {
  const safeSpeed = clampLerpFactor(factor);
  const adjustedSpeed = safeSpeed * deltaTime;

  return current.lerp(target, adjustedSpeed);
};

export const lerpCameraLookAt = (
  current: THREE.Vector3,
  target: THREE.Vector3,
  factor: number,
  deltaTime: number,
): THREE.Vector3 => {
  const safeSpeed = clampLerpFactor(factor);
  const adjustedSpeed = safeSpeed * deltaTime;

  return current.lerp(target, adjustedSpeed);
};
