import React, { useRef } from 'react';

import * as THREE from 'three';

import { Billboards3D } from './Billboard/3d/Billboards3D';
import { BILLBOARD_COLLIDERS } from './Billboard/3d/colliderConfigs';
import { CameraController } from './CameraControlller';
import { Car } from './Car/Car';
import { useCameraMode } from '../../hooks/useCameraMode';
import { useInputRouter } from '../../hooks/useInputerRouter';
import { DEFAULT_PHYSICS_CONFIG } from '../../types/vehicle';

import type { VehiclePhysicsConfig } from '../../types/vehicle';

interface StageProps {
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
}

export const Stage: React.FC<StageProps> = ({ physicsConfig = DEFAULT_PHYSICS_CONFIG }) => {
  const carRootRef = useRef<THREE.Group>(null);
  const carSpeedRef = useRef<number>(0);

  const cameraMode = useCameraMode();
  const { carControlsRef, arcadeControlsRef } = useInputRouter(cameraMode.modeRef);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />

      <CameraController
        targetRef={carRootRef}
        currentSpeedRef={carSpeedRef}
        modeControls={cameraMode}
      />

      <Car
        sharedRootRef={carRootRef}
        sharedSpeedRef={carSpeedRef}
        colliders={BILLBOARD_COLLIDERS}
        physicsConfig={physicsConfig}
        controlsRef={carControlsRef}
      />

      <Billboards3D
        carPositionRef={carRootRef}
        cameraControls={cameraMode}
        arcadeControlsRef={arcadeControlsRef}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
    </>
  );
};
