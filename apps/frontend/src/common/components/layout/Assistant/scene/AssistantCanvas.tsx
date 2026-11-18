import { Suspense, useEffect } from 'react';

import { Environment } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';

import { AssistantCube } from './AssistantCube';
import { AssistantRig } from './AssistantRig';
import { isAssistantActive, useAssistantStore } from '../store/assistant.Store';

import { isSoftwareRenderer } from '@/common/utils/webgl/capabilities';

/**
 * The single, app-wide Three.js canvas for the assistant cube: camera,
 * tonemapping, a violet key light with a cool rim light, an Environment map
 * for the cube's metal, and fog. It always holds the rig and the cube; the
 * current page adds an accessory inside the cube body and any extra scene
 * content (useAssistantAccessory / useAssistantScene).
 *
 * Renders on demand: the rig keeps requesting frames while a page uses the
 * cube, so a page without it costs nothing per frame.
 *
 * Exports:
 *  - AssistantCanvas (default export too).
 */

/**
 * Requests one frame whenever the page starts or stops using the cube, so the
 * rig can show it — or hide it, instead of leaving the last frame on screen.
 */
function ActiveInvalidator({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [active, invalidate]);
  return null;
}

export function AssistantCanvas() {
  const scene = useAssistantStore((s) => s.scene);
  const accessory = useAssistantStore((s) => s.accessory);
  const active = useAssistantStore(isAssistantActive);
  const softwareRenderer = isSoftwareRenderer();

  return (
    <Canvas
      frameloop="demand"
      dpr={softwareRenderer ? 1 : [1, 1.75]}
      camera={{ position: [0, 0, 5], fov: 35, near: 0.1, far: 100 }}
      gl={{
        antialias: !softwareRenderer,
        toneMapping: 3,
        toneMappingExposure: 1.15,
      }}
      // R3F sets pointer-events: auto on its wrapper; on a fixed full-screen
      // layer that swallows the mouse wheel. The scene uses no R3F events.
      style={{ touchAction: 'pan-y', pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.35} color="#b9a6ff" />
      <spotLight position={[3, 4, 4]} angle={0.6} penumbra={1} intensity={3} color="#e9ddff" />
      <directionalLight position={[-3, 2, -3]} intensity={1.6} color="#8fb4ff" />
      <pointLight position={[0, 0, 3]} intensity={0.6} color="#a78bfa" distance={10} />

      <Suspense fallback={null}>
        <AssistantRig>
          <AssistantCube>{accessory}</AssistantCube>
        </AssistantRig>
        {scene}
      </Suspense>

      <ActiveInvalidator active={active} />

      {!softwareRenderer && <Environment preset="studio" environmentIntensity={0.6} />}

      <fog attach="fog" args={['#12121d', 7, 20]} />
    </Canvas>
  );
}

export default AssistantCanvas;
