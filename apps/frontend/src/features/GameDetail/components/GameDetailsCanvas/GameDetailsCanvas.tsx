import { Suspense } from 'react';

import { Canvas, type RootState } from '@react-three/fiber';
import { OrthographicCamera } from 'three';

import GameDetailScene from './GameDetailScene';

const orthoCamera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);

const handleCreated = ({ gl, set }: RootState) => {
  gl.setClearColor(0x000000, 0);
  set({ camera: orthoCamera });
};

function GameDetailCanvas() {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      frameloop="always"
      onCreated={handleCreated}
    >
      <Suspense fallback={null}>
        <GameDetailScene />
      </Suspense>
    </Canvas>
  );
}

export default GameDetailCanvas;
