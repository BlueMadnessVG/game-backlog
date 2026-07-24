import { ScrollControls, Environment, ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import styles from './css/HeroScene.module.css';
import { DeconstructedController } from '../3d/DestructedController';

export function HeroScene() {
  return (
    <div className={styles.sceneContainer}>
      <Canvas
        shadows
        camera={{ position: [0, 0, 4], fov: 35, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: 3, toneMappingExposure: 1.2 }}
      >
        {/* Dramatic studio lighting — key + fill + rim */}
        <ambientLight intensity={0.15} />

        {/* Key light — warm, from upper right */}
        <spotLight
          position={[4, 6, 4]}
          angle={0.4}
          penumbra={1}
          intensity={3}
          color="#ffe0c0"
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        {/* Fill light — cool, from lower left */}
        <spotLight
          position={[-3, -2, 3]}
          angle={0.6}
          penumbra={1}
          intensity={1.2}
          color="#c0d0ff"
        />

        {/* Rim light — sharp, from behind */}
        <directionalLight position={[0, 3, -5]} intensity={2} color="#ffffff" />

        {/* Subtle platform-colored accent lights */}
        <pointLight position={[1, 1, 2]} intensity={0.8} color="#003791" distance={10} />
        <pointLight position={[-1, 1, 2]} intensity={0.8} color="#107C10" distance={10} />

        {/* 3 pages of scroll = 3x viewport height */}
        <ScrollControls pages={3} damping={0.1}>
          <DeconstructedController />
        </ScrollControls>

        {/* Environment for chrome reflections — "studio" or "city" */}
        <Environment preset="studio" />

        {/* Ground shadow for weight */}
        <ContactShadows
          position={[0, -0.8, 0]}
          opacity={0.5}
          scale={8}
          blur={2.5}
          far={4}
          color="#000000"
        />

        <fog attach="fog" args={['#050505', 6, 18]} />
      </Canvas>
    </div>
  );
}
