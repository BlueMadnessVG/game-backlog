import { Edges } from '@react-three/drei';
import * as THREE from 'three';

interface EdgesMeshProps {
  name?: string;
  geometry: THREE.BufferGeometry;
  color?: string;
  /** Angle in degrees. Any two adjacent faces meeting at an angle sharper than
   *  this get an edge drawn. 15–25 is perfect for low-poly models. */
  threshold?: number;
  /** Line thickness in pixels (WebGL line width, usually 1 is safest) */
  lineWidth?: number;
  castShadow?: boolean;
}

export function EdgesMesh({
  name,
  geometry,
  color = '#aaaaaa',
  threshold = 15,
  lineWidth = 1,
  castShadow = true,
}: EdgesMeshProps) {
  return (
    <mesh name={name} geometry={geometry} castShadow={castShadow}>
      {/* Invisible solid body — writes depth so back edges are hidden */}
      <meshBasicMaterial colorWrite={false} />
      {/* Actual crease edges, not silhouette */}
      <Edges
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
