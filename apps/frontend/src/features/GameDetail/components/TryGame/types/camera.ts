// types/camera.ts
import * as THREE from 'three';

// ── Follow config ─────────────────────────────────────────────────────────────
export interface CameraFollowConfig {
  readonly offset: Readonly<THREE.Vector3>;
  readonly lookAtOffset: Readonly<THREE.Vector3>;
  readonly positionLerpFactor: number;
  readonly lookAtLerpFactor: number;
  readonly speedZoomFactor: number;
}

export const DEFAULT_CAMERA_CONFIG: Readonly<CameraFollowConfig> = {
  offset: new THREE.Vector3(0, 5, -11),
  lookAtOffset: new THREE.Vector3(0, 2, -4),
  positionLerpFactor: 4.5,
  lookAtLerpFactor: 6.0,
  speedZoomFactor: -0.15,
} as const;

// ── Camera mode ───────────────────────────────────────────────────────────────

export type CameraMode = 'driving' | 'zoomIn' | 'arcade' | 'zoomOut';

// ── Inspect pose ──────────────────────────────────────────────────────────────
export interface ArcadeCameraPose {
  readonly position: THREE.Vector3;
  readonly lookAt: THREE.Vector3;
}

// ── Arcade cabinet camera offsets ─────────────────────────────────────────────
// ── Tuning guide ─────────────────────────────────────────────────────────────
//   eyeOffset.x    — increase to zoom out, decrease to zoom in
//   eyeOffset.y    — raise/lower camera eye height
//   screenOffset.y — raise/lower the lookAt point
//   Multiply by (newScale / 0.5) if CABINET_SCALE changes.
//

export const ARCADE_CAMERA_LOCAL = {
  eyeOffset: new THREE.Vector3(5, 4, 0),
  screenOffset: new THREE.Vector3(0.798, 4.5, 0),
} as const;

// ── Trophy case camera offsets ────────────────────────────────────────────────
// ── Tuning guide ─────────────────────────────────────────────────────────────
//   eyeOffset.z    — increase to zoom out, decrease to zoom in
//   eyeOffset.y    — raise/lower camera eye relative to glass section
//   screenOffset   — should match SCREEN_OFFSET in TrophyCaseMesh exactly
//   Multiply by (newScale / 0.12) if CASE_SCALE changes.
//

export const TROPHY_CASE_CAMERA_LOCAL = {
  eyeOffset: new THREE.Vector3(-0.322, 4.42, 3.905),

  // Local screen/lookAt focus target relative to the mesh base
  screenOffset: new THREE.Vector3(0.045, 3.795, 2.949),
} as const;

// ── Lerp speeds ───────────────────────────────────────────────────────────────

export const CAMERA_LERP = {
  zoomIn: 5.0,
  zoomOut: 3.5,
} as const;

// ── Arrival thresholds (squared distance) ─────────────────────────────────────

export const CAMERA_ARRIVAL_SQ = {
  zoomIn: 0.08,
  zoomOut: 0.5,
} as const;

// ── Field of view ─────────────────────────────────────────────────────────────

export const CAMERA_FOV = {
  driving: 60,
  arcade: 35,
  TrophyCase: 60,
} as const;
