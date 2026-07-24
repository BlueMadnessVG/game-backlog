import { ScrollControls, Environment, ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import { DeconstructedController } from '../3d/DestructedController';

export function HeroScene() {
  return (
    <div className="fixed inset-0 z-0 bg-[#050505]">
      <Canvas
        shadows
        camera={{ position: [0, 0, 180], fov: 35, near: 0.1, far: 1000 }}
        gl={{ antialias: true, toneMapping: 3, toneMappingExposure: 1.2 }}
      >
        {/* Dramatic studio lighting — key + fill + rim */}
        <ambientLight intensity={0.1} />

        {/* Key light — warm, from upper right */}
        <spotLight
          position={[80, 100, 80]}
          angle={0.3}
          penumbra={1}
          intensity={2}
          color="#ffe0c0"
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        {/* Fill light — cool, from lower left */}
        <spotLight
          position={[-60, -40, 60]}
          angle={0.5}
          penumbra={1}
          intensity={0.8}
          color="#c0d0ff"
        />

        {/* Rim light — sharp, from behind */}
        <directionalLight position={[0, 50, -100]} intensity={1.5} color="#ffffff" />

        {/* Subtle platform-colored accent lights */}
        <pointLight position={[50, 20, 50]} intensity={0.5} color="#003791" distance={150} />
        <pointLight position={[-50, 20, 50]} intensity={0.5} color="#107C10" distance={150} />

        {/* 3 pages of scroll = 3x viewport height */}
        <ScrollControls pages={3} damping={0.1}>
          <DeconstructedController />
        </ScrollControls>

        {/* Environment for chrome reflections — "studio" or "city" */}
        <Environment preset="studio" />

        {/* Ground shadow for weight */}
        <ContactShadows
          position={[0, -60, 0]}
          opacity={0.4}
          scale={200}
          blur={2.5}
          far={100}
          color="#000000"
        />

        {/* Fog for depth — museum case feel */}
        <fog attach="fog" args={['#050505', 200, 500]} />
      </Canvas>
    </div>
  );
}
