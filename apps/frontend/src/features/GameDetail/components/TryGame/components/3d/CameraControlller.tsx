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
import type { CameraFollowConfig, ArcadeCameraPose } from '../../types/camera';
import type { RootState } from '@react-three/fiber';

interface CameraControllerProps {
  readonly targetRef: React.RefObject<THREE.Group | null>;
  readonly currentSpeedRef: React.MutableRefObject<number>;
  readonly cameraConfig?: Readonly<CameraFollowConfig>;
  readonly modeControls?: CameraModeControls;
}

const ZOOM_ARRIVAL_SQ = 0.08;
const ZOOM_RETURN_SQ = 0.5;

export const CameraController: React.FC<CameraControllerProps> = ({
  targetRef,
  currentSpeedRef,
  cameraConfig = DEFAULT_CAMERA_CONFIG,
  modeControls,
}) => {
  const idealPosition = useRef(new THREE.Vector3());
  const idealLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());

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

  // ── Sub-Routine: Zoom In Handler ──────────────────────────────────────────
  const handleZoomIn = (state: RootState, delta: number, pose: ArcadeCameraPose) => {
    state.camera.position.lerp(pose.position, ARCADE_ZOOM_LERP * delta);
    currentLookAt.current.lerp(pose.lookAt, ARCADE_ZOOM_LERP * delta);
    state.camera.lookAt(currentLookAt.current);

    if (state.camera.position.distanceToSquared(pose.position) < ZOOM_ARRIVAL_SQ) {
      state.camera.position.copy(pose.position);
      currentLookAt.current.copy(pose.lookAt);
      state.camera.lookAt(pose.lookAt);
      if (modeControls) {
        // eslint-disable-next-line react-hooks/immutability
        modeControls.modeRef.current = 'arcade';
      }
    }
  };

  // ── Sub-Routine: Zoom Out Handler ─────────────────────────────────────────
  const handleZoomOut = (state: RootState, delta: number, target: THREE.Group) => {
    const speed = currentSpeedRef.current;
    idealPosition.current = calculateIdealCameraPosition(target.matrixWorld, speed, cameraConfig);
    idealLookAt.current = calculateIdealLookAtPosition(target.matrixWorld, cameraConfig);

    state.camera.position.lerp(idealPosition.current, ARCADE_ZOOM_LERP * delta);
    currentLookAt.current.lerp(idealLookAt.current, ARCADE_ZOOM_LERP * delta);
    state.camera.lookAt(currentLookAt.current);

    if (state.camera.position.distanceToSquared(idealPosition.current) < ZOOM_RETURN_SQ) {
      if (modeControls) {
        // eslint-disable-next-line react-hooks/immutability
        modeControls.modeRef.current = 'driving';
      }
    }
  };

  // ── Sub-Routine: Driving Follow Handler ────────────────────────────────────
  const handleDriving = (state: RootState, delta: number, target: THREE.Group) => {
    const speed = currentSpeedRef.current;
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
  };

  // ── Execution Loop ────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const target = targetRef.current;
    if (!target) return;

    const mode = modeControls?.modeRef.current ?? 'driving';
    const pose = modeControls?.poseRef.current;

    switch (mode) {
      case 'zoomIn':
        if (pose) handleZoomIn(state, delta, pose);
        break;
      case 'arcade':
        if (pose) {
          state.camera.position.copy(pose.position);
          state.camera.lookAt(pose.lookAt);
        }
        break;
      case 'zoomOut':
        handleZoomOut(state, delta, target);
        break;
      default:
        handleDriving(state, delta, target);
        break;
    }
  });

  return null;
};
