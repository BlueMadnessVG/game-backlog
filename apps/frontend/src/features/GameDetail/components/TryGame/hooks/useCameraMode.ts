import { useCallback, useRef } from 'react';

import type { ArcadeCameraPose, CameraMode } from '../types/camera';

/**
 * Manages the camera state machine used by CameraController.
 *
 * SRP: the only responsibility of this hook is tracking which camera
 *      mode is active and providing stable callbacks to change it.
 *
 * Why refs instead of useState?
 *   CameraController reads the mode inside useFrame (every tick).
 *   Using useState would re-render the entire scene tree on every
 *   mode change.  A ref is mutated directly and read in the same
 *   frame with zero React overhead.
 *
 * State machine:
 *
 *   openArcade()           closeArcade()
 *        │                      │
 *   driving → zoomIn → arcade → zoomOut → driving
 *                  (auto, no     (auto, no
 *                  callback)     callback)
 *
 * The zoomIn → arcade and zoomOut → driving transitions are triggered
 * automatically by CameraController once the lerp is close enough to
 * the target (see ZOOM_ARRIVAL_THRESHOLD in CameraController).
 */
export interface CameraModeControls {
  /** Current mode — read every frame inside useFrame, never in render. */
  readonly modeRef: React.MutableRefObject<CameraMode>;
  /** Target pose for the arcade close-up — null when in driving mode. */
  readonly poseRef: React.MutableRefObject<ArcadeCameraPose | null>;
  /** Call when the player opens a billboard (E key). */
  readonly openArcade: (pose: ArcadeCameraPose) => void;
  /** Call when the player closes the billboard (✕ button). */
  readonly closeArcade: () => void;
}

export function useCameraMode(): CameraModeControls {
  const modeRef = useRef<CameraMode>('driving');
  const poseRef = useRef<ArcadeCameraPose | null>(null);

  const openArcade = useCallback((pose: ArcadeCameraPose) => {
    poseRef.current = pose;
    modeRef.current = 'zoomIn';
  }, []);

  const closeArcade = useCallback(() => {
    if (modeRef.current === 'arcade') {
      modeRef.current = 'zoomOut';
    }
  }, []);

  return { modeRef, poseRef, openArcade, closeArcade };
}
