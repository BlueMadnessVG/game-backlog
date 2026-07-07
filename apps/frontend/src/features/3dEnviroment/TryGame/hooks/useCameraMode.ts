import { useRef, useCallback } from 'react';

import * as THREE from 'three';

import type { CameraMode, ArcadeCameraPose } from '../types/camera';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CameraModeControls {
  /** Ref polled every frame by CameraController — never triggers a re-render. */
  modeRef: React.MutableRefObject<CameraMode>;
  /** The target arcade pose set when opening a cabinet. */
  poseRef: React.MutableRefObject<ArcadeCameraPose | null>;
  /**
   * Transition to a new mode. Use this instead of writing modeRef.current
   * directly so the update goes through a stable, typed setter.
   */
  setMode: (mode: CameraMode) => void;
  /**
   * Called when the player opens an arcade cabinet (presses E).
   * Stores the pose and starts the zoom-in sequence.
   */
  openArcade: (pose: ArcadeCameraPose) => void;
  /**
   * Called when the player closes the arcade screen.
   * Starts the zoom-out sequence back to the driving camera.
   */
  closeArcade: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCameraMode(): CameraModeControls {
  const modeRef = useRef<CameraMode>('driving');
  const poseRef = useRef<ArcadeCameraPose | null>(null);

  const setMode = useCallback((mode: CameraMode) => {
    modeRef.current = mode;
  }, []);

  const openArcade = useCallback((pose: ArcadeCameraPose) => {
    // Clone vectors so the caller can't mutate them after passing in
    poseRef.current = {
      position: new THREE.Vector3().copy(pose.position),
      lookAt: new THREE.Vector3().copy(pose.lookAt),
    };
    modeRef.current = 'zoomIn';
  }, []);

  const closeArcade = useCallback(() => {
    modeRef.current = 'zoomOut';
  }, []);

  return { modeRef, poseRef, setMode, openArcade, closeArcade };
}
