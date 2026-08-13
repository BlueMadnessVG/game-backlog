import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const lerp = THREE.MathUtils.lerp;

/**
 * Hexagonal "portal" glow that blooms under a face button while it's hovered.
 * A bright hex core + soft outer hex ring, additive-blended and pulsing, so the
 * hover reads as a charged socket rather than a flat puddle of light.
 *
 * Exports:
 *  - ButtonHoverPortal (default): reads its glow state from activeRef every
 *    frame (no React re-renders) and eases scale + opacity toward hovered.
 */
export default function ButtonHoverPortal({
  color,
  activeRef,
}: {
  color: string;
  activeRef: React.MutableRefObject<boolean>;
}) {
  const group = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    const active = activeRef.current ? 1 : 0;
    const s = lerp(group.current?.scale.x ?? 0, active, 0.12);
    if (group.current) group.current.scale.setScalar(s);

    if (coreMat.current) {
      const pulse = active > 0 ? 0.85 + Math.sin(state.clock.elapsedTime * 5) * 0.15 : 1;
      coreMat.current.opacity = 0.5 * s * pulse;
    }

    if (ringMat.current) {
      ringMat.current.opacity = 0.28 * s;
      if (group.current) group.current.rotation.z += delta * 0.6 * s;
    }
  });

  return (
    <group ref={group} position={[0, -2, 0]} scale={0}>
      <mesh>
        <cylinderGeometry args={[4, 4, 0.5, 6]} />
        <meshBasicMaterial
          ref={coreMat}
          color={color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh>
        <ringGeometry args={[4.6, 7, 6]} />
        <meshBasicMaterial
          ref={ringMat}
          color={color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
