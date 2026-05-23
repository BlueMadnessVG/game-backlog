// components/3d/Stage.tsx
import React, { useRef } from 'react';

import { Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { Billboards3D } from './Billboard/3d/Billboards3D';
import { CameraController } from './CameraControlller';
import { Car } from './Car';
import { useGamesByCategory } from '../../hooks/useGamesByCategory';

export const Stage: React.FC = () => {
  const carRootRef = useRef<THREE.Group>(null);
  const carSpeedRef = useRef<number>(0);
  const { games: gamesByCategory } = useGamesByCategory();

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
        <Car sharedRootRef={carRootRef} sharedSpeedRef={carSpeedRef} />
        <CameraController targetRef={carRootRef} currentSpeedRef={carSpeedRef} />
        {/* All billboard UI now lives inside the Canvas */}
        <Billboards3D carPositionRef={carRootRef} gamesByCategory={gamesByCategory} />
      </Canvas>
    </div>
  );
};
