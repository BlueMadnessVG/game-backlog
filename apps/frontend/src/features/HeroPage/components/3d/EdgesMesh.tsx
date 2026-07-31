import { useMemo, useRef, type ComponentRef } from 'react';

import { Edges } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EdgesMeshProps {
  name?: string;
  geometry: THREE.BufferGeometry;
  color?: string;
  threshold?: number;
  lineWidth?: number;
  castShadow?: boolean;
  activeRef?: React.MutableRefObject<boolean>;
  glowColor?: string;
  glowIntensity?: number;
  glowSpeed?: number;
}

export function EdgesMesh({
  name,
  geometry,
  color = '#aaaaaa',
  threshold = 15,
  lineWidth = 4,
  castShadow = true,
  activeRef,
  glowColor,
  glowIntensity = 2.2,
  glowSpeed = 10,
}: EdgesMeshProps) {
  const edgesRef = useRef<ComponentRef<typeof Edges>>(null);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const targetColor = useMemo(
    () =>
      glowColor ? new THREE.Color(glowColor) : baseColor.clone().multiplyScalar(glowIntensity),
    [glowColor, baseColor, glowIntensity],
  );

  const glow = useRef(0);

  useFrame((state, delta) => {
    if (!activeRef) return;
    const material = edgesRef.current?.material;
    if (!material) return;

    const target = activeRef.current ? 1 : 0;
    glow.current = THREE.MathUtils.lerp(glow.current, target, 1 - Math.exp(-glowSpeed * delta));

    const pulse = activeRef.current ? 0.9 + Math.sin(state.clock.elapsedTime * 6) * 0.1 : 1;

    material.color.copy(baseColor).lerp(targetColor, glow.current * pulse);
  });

  return (
    <mesh name={name} geometry={geometry} castShadow={castShadow}>
      {/* Invisible solid body — writes depth so back edges are hidden */}
      <meshBasicMaterial colorWrite={false} />
      {/* Actual crease edges, not silhouette */}
      <Edges
        ref={edgesRef}
        name={name ? `${name}_edges` : undefined}
        color={color}
        threshold={threshold}
        lineWidth={lineWidth}
        toneMapped={false}
        renderOrder={1}
      />
    </mesh>
  );
}
