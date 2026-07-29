import { Outlines } from '@react-three/drei';
import * as THREE from 'three';

interface EdgesMeshProps {
  /** Optional Object3D name, mirrors the source mesh name for easier debugging in devtools */
  name?: string;
  /** Geometry to outline — pass nodes.X.geometry straight from a gltfjsx export */
  geometry: THREE.BufferGeometry;
  /** Outline color */
  color?: string;
  /** Shell inflation amount. Not a literal pixel value like before — tune by eye.
   *  drei's own default is 0.05; start there and adjust. */
  thickness?: number;
  /** Radians, not degrees. Normals on either side of an angle sharper than this get
   *  "creased" before the shell is extruded, which keeps the outline from pinching or
   *  tearing at hard corners. Math.PI (default) leaves the model's baked-in normals
   *  alone. If outlines look distorted at sharp edges (button rims, D-pad corners),
   *  try lowering it — e.g. Math.PI / 4. */
  angle?: number;
  /** Whether the (invisible) solid mesh still casts a shadow onto the ground */
  castShadow?: boolean;
}

/**
 * Renders a mesh as a pure camera-facing silhouette — no interior creases at all.
 * The real geometry draws fully invisible (colorWrite disabled) so it still occupies
 * the depth buffer, and drei's <Outlines> draws a slightly inflated, backface-only
 * shell around it. That shell only shows where it pokes out past the true silhouette
 * edge; the invisible pass is what keeps it from filling in as a solid shape instead
 * of a thin rim. Because this is computed from the current view, it updates as the
 * camera orbits, unlike a fixed set of edge lines.
 */
export function EdgesMesh({
  name,
  geometry,
  color = '#aaaaaa',
  thickness = 3,
  angle = Math.PI,
  castShadow = true,
}: EdgesMeshProps) {
  return (
    <mesh name={name} geometry={geometry} castShadow={castShadow} renderOrder={0}>
      <meshBasicMaterial colorWrite={false} />
      <Outlines
        name={name ? `${name}_outline` : undefined}
        color={color}
        thickness={thickness}
        angle={angle}
        toneMapped={false}
        renderOrder={1}
      />
    </mesh>
  );
}
