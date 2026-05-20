// components/3d/Stage.tsx
import React, { useRef } from 'react';

import { Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { CameraController } from './CameraControlller';
import { Car } from './Car';

export const Stage: React.FC = () => {
  // Master references to share transform telemetry with the camera without triggers re-renders
  const carRootRef = useRef<THREE.Group>(null);
  const carSpeedRef = useRef<number>(0);

  return (
    <div className="w-screen h-screen bg-slate-900">
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

        {/* The Car updates shared mutable ref counters internally every frame */}
        <Car sharedRootRef={carRootRef} sharedSpeedRef={carSpeedRef} />

        {/* The Camera monitors those values passively and snaps the viewport smoothly */}
        <CameraController targetRef={carRootRef} currentSpeedRef={carSpeedRef} />
      </Canvas>
    </div>
  );
};
