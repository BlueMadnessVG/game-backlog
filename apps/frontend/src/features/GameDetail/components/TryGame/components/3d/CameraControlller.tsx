// components/3d/CameraController.tsx
import React, { useEffect, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ARCADE_ZOOM_LERP, DEFAULT_CAMERA_CONFIG } from '../../types/camera';
import {
  calculateIdealCameraPosition,
  calculateIdealLookAtPosition,
  lerpCameraPosition,
  lerpCameraLookAt,
} from '../../utils/cameraCalculators';

import type { CameraModeControls } from '../../hooks/useCameraMode';
import type { CameraFollowConfig } from '../../types/camera';

interface CameraControllerProps {
  readonly targetRef: React.RefObject<THREE.Group | null>;
  readonly currentSpeedRef: React.MutableRefObject<number>;
  readonly cameraConfig?: Readonly<CameraFollowConfig>;
  /**
   * Camera mode controls from useCameraMode().
   * REQUIRED for arcade zoom to work.
   * When absent the controller silently stays in driving mode — a dev
   * warning is emitted so the missing wire-up is immediately visible.
   */
  readonly modeControls?: CameraModeControls;
}

const ZOOM_ARRIVAL_SQ = 0.08; // squared-distance threshold: zoomIn → arcade
const ZOOM_RETURN_SQ = 0.5; // squared-distance threshold: zoomOut → driving

export const CameraController: React.FC<CameraControllerProps> = ({
  targetRef,
  currentSpeedRef,
  cameraConfig = DEFAULT_CAMERA_CONFIG,
  modeControls,
}) => {
  const idealPosition = useRef(new THREE.Vector3());
  const idealLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());

  // ── Dev guard ────────────────────────────────────────────────────────────
  // modeControls is optional for backward compat, but its absence is a
  // common mistake that produces zero console output (optional chaining
  // silently skips every call).  Warn once so the wire-up gap is obvious.
  useEffect(() => {
    if (import.meta.env.VITE_NODE_ENV !== 'production' && !modeControls) {
      console.warn(
        '[CameraController] modeControls prop is not provided.\n' +
          'Arcade cabinet zoom will silently do nothing.\n' +
          'Fix: call useCameraMode() in your scene root and pass the result\n' +
          '     as modeControls to CameraController AND cameraControls to Billboards3D.',
      );
    }
  }, [modeControls]);

  useFrame((state, delta) => {
    const target = targetRef.current;
    if (!target) return;

    const mode = modeControls?.modeRef.current ?? 'driving';
    const pose = modeControls?.poseRef.current ?? null;

    // ── ZOOM IN ───────────────────────────────────────────────────────────
    if (mode === 'zoomIn' && pose) {
      state.camera.position.lerp(pose.position, ARCADE_ZOOM_LERP * delta);
      currentLookAt.current.lerp(pose.lookAt, ARCADE_ZOOM_LERP * delta);
      state.camera.lookAt(currentLookAt.current);

      if (state.camera.position.distanceToSquared(pose.position) < ZOOM_ARRIVAL_SQ) {
        state.camera.position.copy(pose.position);
        currentLookAt.current.copy(pose.lookAt);
        state.camera.lookAt(pose.lookAt);
        // eslint-disable-next-line react-hooks/immutability
        if (modeControls) modeControls.modeRef.current = 'arcade';
      }
      return;
    }

    // ── ARCADE LOCKED ─────────────────────────────────────────────────────
    if (mode === 'arcade' && pose) {
      state.camera.position.copy(pose.position);
      state.camera.lookAt(pose.lookAt);
      return;
    }

    // ── ZOOM OUT ──────────────────────────────────────────────────────────
    if (mode === 'zoomOut') {
      const speed = currentSpeedRef.current ?? 0;
      idealPosition.current = calculateIdealCameraPosition(target.matrixWorld, speed, cameraConfig);
      idealLookAt.current = calculateIdealLookAtPosition(target.matrixWorld, cameraConfig);

      state.camera.position.lerp(idealPosition.current, ARCADE_ZOOM_LERP * delta);
      currentLookAt.current.lerp(idealLookAt.current, ARCADE_ZOOM_LERP * delta);
      state.camera.lookAt(currentLookAt.current);

      if (state.camera.position.distanceToSquared(idealPosition.current) < ZOOM_RETURN_SQ) {
        if (modeControls) modeControls.modeRef.current = 'driving';
      }
      return;
    }

    // ── DRIVING (default) ─────────────────────────────────────────────────
    const speed = currentSpeedRef.current ?? 0;

    idealPosition.current = calculateIdealCameraPosition(target.matrixWorld, speed, cameraConfig);
    idealLookAt.current = calculateIdealLookAtPosition(target.matrixWorld, cameraConfig);

    state.camera.position.copy(
      lerpCameraPosition(
        state.camera.position,
        idealPosition.current,
        cameraConfig.positionLerpFactor,
        delta,
      ),
    );

    currentLookAt.current = lerpCameraLookAt(
      currentLookAt.current,
      idealLookAt.current,
      cameraConfig.lookAtLerpFactor,
      delta,
    );

    state.camera.lookAt(currentLookAt.current);
  });

  return null;
};
