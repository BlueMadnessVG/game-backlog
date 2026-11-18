// cspell:words GLTF gltfjsx rippomadness Sketchfab
import { useGLTF } from '@react-three/drei';

import type { Material, Mesh } from 'three';

/**
 * Placeholder body for the assistant: a GLTF cube loaded from
 * /models/cube (gltfjsx output, adapted).
 *
 * Model: "Companion Cube - Portal 2 version" by rippomadness
 * (https://sketchfab.com/rippomadness), CC-BY-4.0. Credit is shown on the
 * page (ClosingCta). Swap for the project's own model before a public launch.
 *
 * The raw model is ~2.04 units across; it is scaled to CUBE_SIZE so the rig's
 * size math and the corner-light positions in AssistantCube line up.
 *
 * Exports:
 *  - CUBE_MODEL_URL: path of the GLTF (also preloaded).
 *  - CubeModel: the scaled model group (default export too).
 */
export const CUBE_MODEL_URL = '/models/cube/scene.gltf';

const RAW_SIZE = 2.036;
const CUBE_SIZE = 1.2;
const MODEL_SCALE = CUBE_SIZE / RAW_SIZE;

export function CubeModel({ scale = 1 }: { scale?: number }) {
  const { nodes, materials } = useGLTF(CUBE_MODEL_URL);
  const mesh = (nodes as Record<string, Mesh>).Companion_P2_CCP2_0;
  const material = (materials as Record<string, Material>).CCP2;

  return (
    <group scale={MODEL_SCALE * scale} dispose={null}>
      <group scale={0.01}>
        <mesh
          geometry={mesh.geometry}
          material={material}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={100}
        />
      </group>
    </group>
  );
}

useGLTF.preload(CUBE_MODEL_URL);

export default CubeModel;
