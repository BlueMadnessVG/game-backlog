import React, { useEffect, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import {
  CAMERA_ARRIVAL_SQ,
  CAMERA_FOV,
  CAMERA_LERP,
  DEFAULT_CAMERA_CONFIG,
} from '../../types/camera';
import {
  calculateIdealCameraPosition,
  calculateIdealLookAtPosition,
  lerpCameraPosition,
  lerpCameraLookAt,
} from '../../utils/cameraCalculators';

import type { CameraModeControls } from '../../hooks/useCameraMode';
import type { CameraFollowConfig, ArcadeCameraPose } from '../../types/camera';
import type { RootState } from '@react-three/fiber';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CameraControllerProps {
  readonly targetRef: React.RefObject<THREE.Group | null>;
  readonly currentSpeedRef: React.MutableRefObject<number>;
  readonly cameraConfig?: Readonly<CameraFollowConfig>;
  readonly modeControls?: CameraModeControls;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerpFov(camera: THREE.Camera, targetFov: number, alpha: number): void {
  if (!(camera instanceof THREE.PerspectiveCamera)) return;
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, alpha);
  camera.updateProjectionMatrix();
}

function snapFov(camera: THREE.Camera, fov: number): void {
  if (!(camera instanceof THREE.PerspectiveCamera)) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CameraController: React.FC<CameraControllerProps> = ({
  targetRef,
  currentSpeedRef,
  cameraConfig = DEFAULT_CAMERA_CONFIG,
  modeControls,
}) => {
  const currentLookAt = useRef(new THREE.Vector3());
  const idealPosition = useRef(new THREE.Vector3());
  const idealLookAt = useRef(new THREE.Vector3());

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

  // ── Sub-routine: zoom in toward arcade cabinet ────────────────────────────
  const handleZoomIn = (state: RootState, delta: number, pose: ArcadeCameraPose): void => {
    const alpha = CAMERA_LERP.zoomIn * delta;

    state.camera.position.lerp(pose.position, alpha);
    currentLookAt.current.lerp(pose.lookAt, alpha);
    state.camera.lookAt(currentLookAt.current);
    lerpFov(state.camera, CAMERA_FOV.arcade, alpha);

    const arrivedAtPose =
      state.camera.position.distanceToSquared(pose.position) < CAMERA_ARRIVAL_SQ.zoomIn;

    if (!arrivedAtPose) return;

    // Snap to exact pose so floating-point drift can't prevent arrival
    state.camera.position.copy(pose.position);
    currentLookAt.current.copy(pose.lookAt);
    state.camera.lookAt(pose.lookAt);
    snapFov(state.camera, CAMERA_FOV.arcade);

    if (modeControls) modeControls.setMode('arcade');
  };

  // ── Sub-routine: hold arcade pose ────────────────────────────────────────
  const handleArcade = (state: RootState, pose: ArcadeCameraPose): void => {
    state.camera.position.copy(pose.position);
    state.camera.lookAt(pose.lookAt);
    snapFov(state.camera, CAMERA_FOV.arcade);
  };

  // ── Sub-routine: zoom out back to follow camera ───────────────────────────
  const handleZoomOut = (state: RootState, delta: number, target: THREE.Group): void => {
    const alpha = CAMERA_LERP.zoomOut * delta;

    idealPosition.current = calculateIdealCameraPosition(
      target.matrixWorld,
      currentSpeedRef.current,
      cameraConfig,
    );
    idealLookAt.current = calculateIdealLookAtPosition(target.matrixWorld, cameraConfig);

    state.camera.position.lerp(idealPosition.current, alpha);
    currentLookAt.current.lerp(idealLookAt.current, alpha);
    state.camera.lookAt(currentLookAt.current);
    lerpFov(state.camera, CAMERA_FOV.driving, alpha);

    const arrivedAtFollow =
      state.camera.position.distanceToSquared(idealPosition.current) < CAMERA_ARRIVAL_SQ.zoomOut;

    if (!arrivedAtFollow) return;

    if (modeControls) modeControls.setMode('driving');
  };

  // ── Sub-routine: normal driving follow ───────────────────────────────────
  const handleDriving = (state: RootState, delta: number, target: THREE.Group): void => {
    idealPosition.current = calculateIdealCameraPosition(
      target.matrixWorld,
      currentSpeedRef.current,
      cameraConfig,
    );
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

  // ── One-shot debug ref: logs once when zoomIn starts ─────────────────────
  const didLogZoomIn = useRef(false);

  // ── Frame loop ────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const target = targetRef.current;
    if (!target) return;

    const mode = modeControls?.modeRef.current ?? 'driving';
    const pose = modeControls?.poseRef.current;

    switch (mode) {
      case 'zoomIn':
        if (import.meta.env.VITE_NODE_ENV !== 'production' && !didLogZoomIn.current) {
          didLogZoomIn.current = true;
          console.debug(
            '[CameraController] zoomIn started',
            '\n  pose:',
            pose ? 'SET' : 'NULL ← bug: openArcade() was not called before mode=zoomIn',
            '\n  cam pos:',
            state.camera.position.toArray().map((v) => v.toFixed(2)),
          );
        }
        if (pose) handleZoomIn(state, delta, pose);
        break;
      case 'arcade':
        didLogZoomIn.current = false;
        if (pose) handleArcade(state, pose);
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
