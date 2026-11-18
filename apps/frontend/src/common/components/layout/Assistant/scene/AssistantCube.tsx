import { useRef, type ReactNode } from 'react';

import { Edges, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { CubeModel } from './CubeModel';
import { pose } from '../face/pose';
import { FACE_H, FACE_W, useFaceTexture } from '../face/useFaceTexture';
import { isAssistantStill, useAssistantStore } from '../store/assistant.Store';

/**
 * Body of the app-wide assistant, with a screen on the front that draws its
 * face. Page-specific 3D parts (an "accessory", e.g. the hero's platform
 * corner lights) are passed as children and rendered in the body's space —
 * the cube is 1.2 units wide, centred, front face at z = 0.6.
 *
 * Two bodies, chosen by `BODY`:
 *  - 'model': the GLTF placeholder (CubeModel) with a mounted round face.
 *  - 'procedural': a code-built dark-purple cube cut into three slabs that
 *    slide apart with `pose.spread`, with a wide face.
 *
 * It is deliberately self-contained so a Maya-authored GLB can replace it
 * later: the rest of the app relies only on the face (store emotion) and
 * `pose` (spread, look, eyes).
 *
 * Exports:
 *  - CUBE_SIZE: the body's width in world units.
 *  - AssistantCube: the cube group (default export too).
 */
export const CUBE_SIZE = 1.2;
const SLAB_H = [0.34, 0.52, 0.34] as const;
const SLAB_Y = [0.43, 0, -0.43] as const;
const SPREAD_DIST = 0.55;
const EDGE_COLOR = '#9d82e6';

const SCREEN_W = 0.96;
const SCREEN_H = SCREEN_W * (FACE_H / FACE_W);

/** Which body to render. Switch to 'procedural' for the code-built cube. */
const BODY: 'model' | 'procedural' = 'model';

/** Radius of the round face screen on the model. */
const MODEL_SCREEN_R = 0.26;
/** Model scale gain at full spread (single mesh: breathes instead of splitting). */
const MODEL_BREATHE = 0.04;

/** Code-built body: three slabs that slide apart with `pose.spread`. */
function ProceduralBody({ faceTexture }: { faceTexture: THREE.Texture }) {
  const slabs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];

  useFrame(() => {
    const spread = pose.spread * SPREAD_DIST;
    slabs[0].current?.position.set(0, SLAB_Y[0] + spread, 0);
    slabs[1].current?.position.set(0, SLAB_Y[1], 0);
    slabs[2].current?.position.set(0, SLAB_Y[2] - spread, 0);
  });

  return (
    <group>
      {SLAB_H.map((h, i) => (
        <group key={i} ref={slabs[i]} position={[0, SLAB_Y[i], 0]}>
          <RoundedBox args={[CUBE_SIZE, h, CUBE_SIZE]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#2b2145" metalness={0.55} roughness={0.38} />
            <Edges threshold={20} color={EDGE_COLOR} lineWidth={1} />
          </RoundedBox>

          {i === 1 && (
            <mesh position={[0, 0, CUBE_SIZE / 2 + 0.004]}>
              <planeGeometry args={[SCREEN_W, SCREEN_H]} />
              <meshBasicMaterial map={faceTexture} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** GLTF placeholder body. A single mesh cannot split, so `pose.spread` makes it breathe. */
function ModelBody({ faceTexture }: { faceTexture: THREE.Texture }) {
  const model = useRef<THREE.Group>(null);

  useFrame(() => {
    model.current?.scale.setScalar(1 + pose.spread * MODEL_BREATHE);
  });

  return (
    <group>
      <group ref={model}>
        <CubeModel />
      </group>

      {/* Mounted round face screen: dark bezel, thin lilac rim, face texture. */}
      <mesh position={[0, 0, CUBE_SIZE / 2 + 0.008]}>
        <circleGeometry args={[MODEL_SCREEN_R + 0.045, 64]} />
        <meshStandardMaterial color="#0a0814" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, CUBE_SIZE / 2 + 0.011]}>
        <ringGeometry args={[MODEL_SCREEN_R + 0.008, MODEL_SCREEN_R + 0.018, 64]} />
        <meshBasicMaterial color="#d0bcff" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, CUBE_SIZE / 2 + 0.012]}>
        <circleGeometry args={[MODEL_SCREEN_R, 64]} />
        <meshBasicMaterial map={faceTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function AssistantCube({ children }: { children?: ReactNode }) {
  const face = useFaceTexture(BODY === 'model' ? 'round' : 'wide');

  useFrame(({ clock }) => {
    const store = useAssistantStore.getState();
    const { emotion } = store;
    // Still (reduced motion): freeze the face's own animation — the
    // talking wave, thinking dots and blinks — on a fixed frame.
    const still = isAssistantStill(store);
    face.update(
      still ? 0 : clock.elapsedTime,
      emotion,
      pose.look,
      !still && emotion !== 'sleep',
      pose.eyes,
    );
  });

  return (
    <group>
      {BODY === 'model' ? (
        <ModelBody faceTexture={face.texture} />
      ) : (
        <ProceduralBody faceTexture={face.texture} />
      )}
      {children}
    </group>
  );
}

export default AssistantCube;
