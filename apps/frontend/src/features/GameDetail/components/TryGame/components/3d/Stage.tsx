import React, { useRef } from 'react';

import { Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { Billboards3D } from './Billboard/3d/Billboards3D';
import { CameraController } from './CameraControlller';
import { Car } from './Car/Car';
import { useCameraMode } from '../../hooks/useCameraMode'; // 1. Import the hook

import type { BillboardConfig } from '../../types/billboard';

const DEFAULT_BILLBOARDS: readonly BillboardConfig[] = [
  {
    position: [-20, 0, -15],
    width: 8,
    height: 6,
    rotation: [0, -Math.PI / 8, 0],
    category: 'playing',
  },
  {
    position: [20, 0, -15],
    width: 8,
    height: 6,
    rotation: [0, Math.PI / 8, 0],
    category: 'completed',
  },
  {
    position: [0, 0, 30],
    width: 8,
    height: 6,
    rotation: [0, 0, 0],
    category: 'backlog',
  },
];

export const Stage: React.FC = () => {
  const carRootRef = useRef<THREE.Group>(null);
  const carSpeedRef = useRef<number>(0);

  // 2. Instantiate the camera tracking machine at the root level
  const cameraModeControls = useCameraMode();

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', position: 'relative' }}>
      <Canvas camera={{ position: [0, 10, -15], fov: 45 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[15, 25, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Grid
          infiniteGrid
          cellSize={1}
          cellThickness={0.8}
          cellColor="#1e293b"
          sectionSize={10}
          sectionThickness={1.2}
          sectionColor="#334155"
          fadeDistance={60}
        />

        <Car
          sharedRootRef={carRootRef}
          sharedSpeedRef={carSpeedRef}
          billboardsConfig={DEFAULT_BILLBOARDS}
        />

        {/* 3. Pass shared references directly into the processing engine */}
        <CameraController
          targetRef={carRootRef}
          currentSpeedRef={carSpeedRef}
          modeControls={cameraModeControls}
        />

        {/* 4. Feed the matching camera tracking handles down to interaction layer loops */}
        <Billboards3D carPositionRef={carRootRef} cameraControls={cameraModeControls} />
      </Canvas>
    </div>
  );
};
