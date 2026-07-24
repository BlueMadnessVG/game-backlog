import { useEffect, useMemo } from 'react';

import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

interface EdgesMeshProps {
  /** Optional Object3D name, mirrors the source mesh name for easier debugging in devtools */
  name?: string;
  /** Geometry to outline — pass nodes.X.geometry straight from a gltfjsx export */
  geometry: THREE.BufferGeometry;
  /** Minimum angle (degrees) between adjacent faces before an edge counts as a "crease".
   *  Lower = more lines (good for low-poly/faceted models), higher = fewer lines
   *  (suppresses noise on smooth, high-poly curved surfaces). Tune per-model by eye. */
  threshold?: number;
  /** Line color */
  color?: string;
  /** Line thickness in CSS pixels (screen-space, independent of camera distance) */
  lineWidth?: number;
  /** Whether the (invisible) solid mesh still casts a shadow onto the ground */
  castShadow?: boolean;
}

/**
 * Renders a mesh as line-art only: the solid geometry is drawn fully invisible
 * (colorWrite disabled) so it still writes to the depth buffer, then the edges
 * are drawn on top as white lines. The invisible pass is what makes far-side
 * edges correctly hide behind the near surface instead of showing through it —
 * without it you'd get an x-ray/wireframe look instead of clean hidden-line art.
 */
export function EdgesMesh({
  name,
  geometry,
  threshold = 1,
  color = '#ffffff',
  lineWidth = 5,
  castShadow = true,
}: EdgesMeshProps) {
  const size = useThree((s) => s.size);

  const edgesGeometry = useMemo(() => {
    const edges = new THREE.EdgesGeometry(geometry, threshold);
    const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);
    edges.dispose();
    return lineGeometry;
  }, [geometry, threshold]);

  const material = useMemo(
    () =>
      new LineMaterial({
        color,
        linewidth: lineWidth,
        worldUnits: false,
        resolution: new THREE.Vector2(size.width, size.height),
        toneMapped: false,
      }),
    [color, lineWidth, size],
  );

  const line = useMemo(() => new LineSegments2(edgesGeometry, material), [edgesGeometry, material]);

  useEffect(
    () => () => {
      edgesGeometry.dispose();
      material.dispose();
    },
    [edgesGeometry, material],
  );

  return (
    <>
      <mesh name={name} geometry={geometry} castShadow={castShadow} renderOrder={0}>
        <meshBasicMaterial colorWrite={false} />
      </mesh>
      <primitive object={line} name={name ? `${name}_edges` : undefined} renderOrder={1} />
    </>
  );
}
