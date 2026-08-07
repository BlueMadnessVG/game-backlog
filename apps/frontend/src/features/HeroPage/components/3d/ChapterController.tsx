import { Suspense } from 'react';

import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import { DeconstructedController } from './DestructedController';

/**
 * Per-chapter controller anchor. Renders a static, centered DeconstructedController
 * in the chapter accent color (body outline only — the face buttons keep their
 * platform colors). Each section gets its own lightweight canvas so the controller
 * lives in normal document flow beside the chapter copy, framed by the section's
 * `.hologram` box.
 */
export function ChapterController({ color }: { color: string }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 5.4, 3.4], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: 3, toneMappingExposure: 1.2 }}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Studio lighting mirrored from the hero scene */}
      <ambientLight intensity={0.15} />

      <spotLight position={[4, 6, 4]} angle={0.4} penumbra={1} intensity={3} color="#ffe0c0" />
      <spotLight position={[-3, -2, 3]} angle={0.6} penumbra={1} intensity={1.2} color="#c0d0ff" />
      <directionalLight position={[0, 3, -5]} intensity={2} color="#ffffff" />

      {/* Subtle accent fill so the chrome picks up the chapter color */}
      <pointLight position={[0, 1, 2]} intensity={1} color={color} distance={10} />

      <Suspense fallback={null}>
        <DeconstructedController color={color} staticPose />
      </Suspense>

      <Environment preset="studio" />
    </Canvas>
  );
}

export default ChapterController;
