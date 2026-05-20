import React, { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { DEFAULT_CAMERA_CONFIG, type CameraFollowConfig } from '../../types/camera';
import {
  calculateIdealCameraPosition,
  calculateIdealLookAtPosition,
  lerpCameraLookAt,
  lerpCameraPosition,
} from '../../utils/cameraCalculators';

interface CameraControllerProps {
  readonly targetRef: React.RefObject<THREE.Group | null>;
  readonly currentSpeedRef: React.MutableRefObject<number>;
  readonly cameraConfig?: Readonly<CameraFollowConfig>;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  targetRef,
  currentSpeedRef,
  cameraConfig = DEFAULT_CAMERA_CONFIG,
}) => {
  const idealPosition = useRef(new THREE.Vector3());
  const idealLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const target = targetRef.current;

    if (!target) return;

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
