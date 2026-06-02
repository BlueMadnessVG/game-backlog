// components/3d/Stage.tsx
import React, { useRef } from 'react';

import { Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { Billboards3D } from './Billboard/3d/Billboards3D';
import { CameraController } from './CameraControlller';
import { Car } from './Car/Car';

import type { BillboardConfig } from '../../types/billboard';

// Configuración estática compartida expuesta con tipado estricto
const DEFAULT_BILLBOARDS: readonly BillboardConfig[] = [
  {
    position: [-20, 0, -15] as const,
    width: 8,
    height: 6,
    rotation: [0, -Math.PI / 8, 0] as const,
    category: 'playing' as const,
  },
  {
    position: [20, 0, -15] as const,
    width: 8,
    height: 6,
    rotation: [0, Math.PI / 8, 0] as const,
    category: 'completed' as const,
  },
  {
    position: [0, 0, 30] as const,
    width: 8,
    height: 6,
    rotation: [0, 0, 0] as const,
    category: 'backlog' as const,
  },
];

export const Stage: React.FC = () => {
  const carRootRef = useRef<THREE.Group>(null);
  const carSpeedRef = useRef<number>(0);

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

        {/* El Auto ahora recibe la configuración para calcular colisiones de forma interna */}
        <Car
          sharedRootRef={carRootRef}
          sharedSpeedRef={carSpeedRef}
          billboardsConfig={DEFAULT_BILLBOARDS}
        />

        <CameraController targetRef={carRootRef} currentSpeedRef={carSpeedRef} />

        {/* Renderizado de Mallas de Interacción */}
        <Billboards3D carPositionRef={carRootRef} />
      </Canvas>
    </div>
  );
};
