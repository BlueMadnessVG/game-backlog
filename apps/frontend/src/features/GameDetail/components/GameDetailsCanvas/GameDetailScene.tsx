import { useRef } from 'react';

import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { ShaderMaterial, Vector2 } from 'three';

import { crtFragmentShader } from './shaders/crtFragment.glsl';
import { crtVertexShader } from './shaders/crtVertex.glsl';

const shaderUniforms = {
  u_time: { value: 0 },
  u_resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
};

function GameDetailScene() {
  'use no memo';

  const { size } = useThree();
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame(({ clock }: RootState) => {
    const mat = materialRef.current;
    if (!mat) return;

    shaderUniforms.u_time.value = clock.elapsedTime;
    shaderUniforms.u_resolution.value.set(size.width, size.height);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={crtVertexShader}
        fragmentShader={crtFragmentShader}
        uniforms={shaderUniforms}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export default GameDetailScene;
