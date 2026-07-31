import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lerp } from 'three/src/math/MathUtils.js';

export default function PlatformHologram({
  position,
  color,
  activeRef,
}: {
  position: [number, number, number];
  color: string;
  activeRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    const target = activeRef.current;
    const current = groupRef.current.scale.x;
    const s = lerp(current, target, 0.12);
    groupRef.current.scale.setScalar(Math.max(0, s));

    if (target > 0.01 && s > 0.01) {
      groupRef.current.position.y = position[1] + Math.sin(t * 3) * 1.5;
      groupRef.current.rotation.y = t * 1.5;

      if (Math.random() > 0.94) {
        groupRef.current.position.x = position[0] + (Math.random() - 0.5) * 0.8;
      } else {
        groupRef.current.position.x = position[0];
      }

      if (scanRef.current) {
        scanRef.current.position.y = ((t * 10) % 14) - 7;
      }
    } else {
      groupRef.current.position.x = position[0];
      groupRef.current.position.y = position[1];
    }
  });

  return (
    <group ref={groupRef} position={position} scale={0}>
      <mesh raycast={() => null}>
        <octahedronGeometry args={[6, 0]} />
        <meshBasicMaterial color={color} wireframe toneMapped={false} />
      </mesh>
      <mesh raycast={() => null}>
        <octahedronGeometry args={[3, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} toneMapped={false} />
      </mesh>
      <mesh ref={scanRef} rotation={[0, 0, Math.PI / 4]} raycast={() => null}>
        <planeGeometry args={[14, 0.25]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={20} distance={30} />
    </group>
  );
}
