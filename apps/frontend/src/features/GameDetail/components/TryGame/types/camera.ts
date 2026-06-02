// types/camera.ts
import * as THREE from 'three';

/**
 * All camera follow behaviour is driven by this config.
 *
 * Offsets are in the car's LOCAL space. With chassis rotation.y = 0:
 *
 *   local +X  →  world right
 *   local +Y  →  world up
 *   local +Z  →  world BEHIND the car  (physics forward = −Z in Three.js)
 *
 * To place the camera BEHIND and ABOVE: offset.z > 0, offset.y > 0
 * To look AHEAD of the car:            lookAtOffset.z < 0
 */
export interface CameraFollowConfig {
  readonly offset: Readonly<THREE.Vector3>;
  readonly lookAtOffset: Readonly<THREE.Vector3>;
  readonly positionLerpFactor: number;
  readonly lookAtLerpFactor: number;
  readonly speedZoomFactor: number;
}

/**
 * Chase camera — sits 11 units behind, 6 above; looks 4 units ahead.
 *
 *  offset       (0,  6, +11)  →  behind and above the car
 *  lookAtOffset (0,  1,  −4)  →  slightly ahead of the car's nose
 */
export const DEFAULT_CAMERA_CONFIG: Readonly<CameraFollowConfig> = {
  offset: new THREE.Vector3(0, 4, -11),
  lookAtOffset: new THREE.Vector3(0, 2, -5),
  positionLerpFactor: 4.5,
  lookAtLerpFactor: 10.0,
  speedZoomFactor: -0.15,
} as const;
