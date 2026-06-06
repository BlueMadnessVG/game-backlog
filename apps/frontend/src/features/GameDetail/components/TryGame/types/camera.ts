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

// ── Arcade pose ───────────────────────────────────────────────────────────────

export interface ArcadeCameraPose {
  readonly position: THREE.Vector3;
  readonly lookAt: THREE.Vector3;
}

// ── Arcade camera tuning ──────────────────────────────────────────────────────
//
// All offsets are in the CABINET'S local space (before the billboard's world
// rotation is applied). They must match the actual mesh geometry.
//
// Screen world centre (cabinet-local, with CABINET_SCALE = 0.5):
//   x = 1.584 × 0.5 = 0.792
//   y = 8.639 × 0.5 = 4.320
//   z = 0
//
// ── Tuning guide ─────────────────────────────────────────────────────────────
//   eyeOffset.x    — increase to zoom out, decrease to zoom in
//   eyeOffset.y    — raise/lower camera eye height
//   screenOffset.y — raise/lower the lookAt point on the screen
//   fov.arcade     — lower = less perspective distortion (better on widescreen)
//   fov.driving    — restore to default when returning to car
//
// If the cabinet model changes scale, multiply all offset values by the ratio:
//   newValue = oldValue × (newScale / 0.5)
//

export const ARCADE_CAMERA_LOCAL = {
  /** Camera eye — in front of and slightly above the screen centre. */
  eyeOffset: new THREE.Vector3(5, 4, 0),
  /** Screen centre — used as the lookAt target. */
  screenOffset: new THREE.Vector3(0.798, 4.5, 0),
} as const;

// ── Lerp speeds ───────────────────────────────────────────────────────────────
//
// Zoom-in and zoom-out use independent speeds so the approach can feel snappy
// while the departure feels weightier and more cinematic.
//

export const CAMERA_LERP = {
  /** Speed for zooming in toward the arcade cabinet. */
  zoomIn: 5.0,
  /** Speed for returning to the driving follow camera. */
  zoomOut: 3.5,
} as const;

// ── Arrival thresholds (squared distance) ─────────────────────────────────────
//
// Kept here so the controller has a single source of truth to import.
// Using squared distance avoids a sqrt per frame.
//

export const CAMERA_ARRIVAL_SQ = {
  /** Snap to final arcade pose when this close. */
  zoomIn: 0.08,
  /** Switch mode back to 'driving' when this close to follow position. */
  zoomOut: 0.5,
} as const;

// ── Field of view ─────────────────────────────────────────────────────────────
//
// A narrower FOV when zoomed into the cabinet reduces perspective distortion,
// which is especially noticeable on wide (1900×800) viewports.
//

export const CAMERA_FOV = {
  /** Default driving FOV. */
  driving: 60,
  /** Tighter FOV used during arcade inspect mode — reduces screen distortion. */
  arcade: 35,
} as const;
