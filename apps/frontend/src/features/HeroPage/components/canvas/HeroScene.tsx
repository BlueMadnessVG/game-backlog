import { Suspense } from 'react';

import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import styles from './css/HeroScene.module.css';
import { SceneInvalidator } from './SceneInvalidator';
import { AssistantCube } from '../3d/AssistantCube';
import { AssistantRig } from '../3d/AssistantRig';
import { ButtonProjector } from '../3d/ButtonProjector';

import { useInteractionObserver } from '@/common/hooks/useInteractionObserver/useInteractionObserver';
import { isSoftwareRenderer } from '@/common/utils/webgl/capabilities';

/**
 * The Three.js canvas for the whole page: one fixed, full-viewport layer that
 * holds the assistant cube from the first screen to the last.
 *
 * Sets up the R3F Canvas (camera, tonemapping), a violet key light with a cool
 * rim light, the AssistantRig (which poses the cube from the scroll timeline
 * and the on-page slots), the ButtonProjector (which publishes the corner
 * lights' screen positions to the hotspots store) and an Environment map for
 * reflections on the cube's metal.
 *
 * Exports:
 *  - HeroScene: the <Canvas> wrapper (default export too).
 */
export function HeroScene() {
  const softwareRenderer = isSoftwareRenderer();
  const { targetRef, isInteracting } = useInteractionObserver({ threshold: 0.05 });

  return (
    <div className={styles.sceneContainer} ref={targetRef}>
      <Canvas
        frameloop={isInteracting ? 'demand' : 'never'}
        dpr={softwareRenderer ? 1 : [1, 1.75]}
        camera={{ position: [0, 0, 5], fov: 35, near: 0.1, far: 100 }}
        gl={{
          antialias: !softwareRenderer,
          toneMapping: 3,
          toneMappingExposure: 1.15,
        }}
        style={{ touchAction: 'pan-y' }}
      >
        <ambientLight intensity={0.35} color="#b9a6ff" />
        <spotLight position={[3, 4, 4]} angle={0.6} penumbra={1} intensity={3} color="#e9ddff" />
        <directionalLight position={[-3, 2, -3]} intensity={1.6} color="#8fb4ff" />
        <pointLight position={[0, 0, 3]} intensity={0.6} color="#a78bfa" distance={10} />

        <Suspense fallback={null}>
          <AssistantRig>
            <AssistantCube />
          </AssistantRig>
        </Suspense>

        <SceneInvalidator />

        <ButtonProjector />

        {!softwareRenderer && <Environment preset="studio" environmentIntensity={0.6} />}

        <fog attach="fog" args={['#12121d', 7, 20]} />
      </Canvas>
    </div>
  );
}

export default HeroScene;
