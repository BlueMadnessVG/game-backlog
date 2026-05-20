import * as THREE from 'three';

export interface CameraFollowConfig {
  readonly offset: Readonly<THREE.Vector3>;
  readonly lookAtOffset: Readonly<THREE.Vector3>;
  readonly positionLerpFactor: number;
  readonly lookAtLerpFactor: number;
  readonly speedZoomFactor: number;
}

export const DEFAULT_CAMERA_CONFIG: Readonly<CameraFollowConfig> = {
  offset: new THREE.Vector3(0, 6, -11),
  lookAtOffset: new THREE.Vector3(0, 1, 3),
  positionLerpFactor: 4.5,
  lookAtLerpFactor: 6.0,
  speedZoomFactor: 0.15,
} as const;

