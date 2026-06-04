// types/camera.ts
import * as THREE from 'three';

// ── Follow config ─────────────────────────────────────────────────────────

export interface CameraFollowConfig {
  readonly offset: Readonly<THREE.Vector3>;
  readonly lookAtOffset: Readonly<THREE.Vector3>;
  readonly positionLerpFactor: number;
  readonly lookAtLerpFactor: number;
  readonly speedZoomFactor: number;
}

export const DEFAULT_CAMERA_CONFIG: Readonly<CameraFollowConfig> = {
  offset: new THREE.Vector3(0, 6, 11),
  lookAtOffset: new THREE.Vector3(0, 1, -4),
  positionLerpFactor: 4.5,
  lookAtLerpFactor: 6.0,
  speedZoomFactor: 0.15,
} as const;

// ── Arcade zoom mode ──────────────────────────────────────────────────────

export type CameraMode = 'driving' | 'zoomIn' | 'arcade' | 'zoomOut';

export interface ArcadeCameraPose {
  readonly position: THREE.Vector3;
  readonly lookAt: THREE.Vector3;
}

export const ARCADE_ZOOM_LERP = 4.0;

/**
 * Local-space offsets used by computeArcadePose in Billboards3D to
 * calculate the world-space arcade camera pose.
 *
 * These offsets are in the CABINET'S local space (before the billboard's
 * world rotation is applied).  They must match the actual mesh geometry.
 *
 * ── How these values were derived ────────────────────────────────────────
 * The new ArcadeCabinetMesh (document 5) has CABINET_SCALE = 0.5 and
 * the screen group sits at model position [1.584, 8.639, 0] with
 * rotation [0, PI/2, 0] (screen faces the cabinet's +X direction).
 *
 * Screen world centre (cabinet-local):
 *   x = 1.584 × 0.5 = 0.792
 *   y = 8.639 × 0.5 = 4.320
 *   z = 0
 *
 * Camera eye: 1.4 m in front of the screen along the screen's facing
 * direction (+X in cabinet local space), slightly higher than screen centre:
 *   x = 0.792 + 1.4 = ~2.2
 *   y = 4.320 + 0.1 = ~4.42  (a tiny rise to look slightly down at screen)
 *   z = 0
 *
 * ── Tuning guide ─────────────────────────────────────────────────────────
 * If the close-up is off:
 *   eyeOffset.x    — increase to zoom out, decrease to zoom in
 *   eyeOffset.y    — raise/lower camera eye height
 *   screenOffset.y — raise/lower the lookAt point on the screen
 *
 * If the cabinet model changes scale, multiply all values by the ratio:
 *   newValue = oldValue × (newScale / 0.5)
 */
export const ARCADE_CAMERA_LOCAL = {
  /** Where the camera eye sits — in front of and slightly above the screen. */
  eyeOffset: new THREE.Vector3(5, 3.4, 0),
  /** Screen centre — used as the lookAt target. */
  screenOffset: new THREE.Vector3(0.792, 4.1, 0),
} as const;
