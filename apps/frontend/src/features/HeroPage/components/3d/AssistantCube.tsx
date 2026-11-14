import { useRef, type ReactNode } from 'react';

import { Edges, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { pose } from './assistantPose';
import { CubeModel } from './CubeModel';
import PlatformHologram from './PlatformHologram';
import { FACE_H, FACE_W, useFaceTexture } from './useFaceTexture';
import { useAssistantStore } from '../../store/assistant.Store';
import {
  useButtonHotspotsStore,
  type HeroButtonKey,
} from '../../store/heroButtonHotspots.Store';
import { PLATFORM_COLORS, type PlatformKey } from '../../utils/platformColors';

/**
 * Body of the page-long assistant, with a screen on the front that draws its
 * face and four platform corner lights (each with a hologram).
 *
 * Two bodies, chosen by `BODY`:
 *  - 'model': the GLTF placeholder (CubeModel) with a mounted face screen.
 *  - 'procedural': a code-built dark-purple cube cut into three slabs that
 *    slide apart ("dissection") during the platform beats.
 *
 * It is deliberately self-contained so a Maya-authored GLB can replace it
 * later: everything the rest of the page relies on lives behind three seams —
 * the face (useAssistantStore.emotion), the four `Hotspot-*` anchors that
 * ButtonProjector projects into the hotspot overlay, and `pose` (spread +
 * per-platform activation).
 *
 * Exports:
 *  - AssistantCube: the cube group (default export too).
 */
const SIZE = 1.2;
const SLAB_H = [0.34, 0.52, 0.34] as const;
const SLAB_Y = [0.43, 0, -0.43] as const;
const SPREAD_DIST = 0.55;
const EDGE_COLOR = '#9d82e6';

const SCREEN_W = 0.96;
const SCREEN_H = SCREEN_W * (FACE_H / FACE_W);

/** Which body to render. Switch to 'procedural' for the code-built cube. */
const BODY: 'model' | 'procedural' = 'model';

/** Radius of the round face screen on the model (fits inside the corner lights). */
const MODEL_SCREEN_R = 0.26;
/** Model scale gain at full spread (single mesh: breathes instead of splitting). */
const MODEL_BREATHE = 0.04;
/** How far the corner lights move outward at full spread, as a fraction. */
const MODEL_PUSH = 0.35;

/** Which slab + corner each platform's light sits on. */
const LIGHTS: {
  key: PlatformKey;
  hotspot: string;
  button: HeroButtonKey;
  slab: 0 | 2;
  side: -1 | 1;
}[] = [
  { key: 'steam', hotspot: 'Hotspot-Cross', button: 'cross', slab: 0, side: -1 },
  { key: 'xbox', hotspot: 'Hotspot-Triangle', button: 'triangle', slab: 0, side: 1 },
  { key: 'playstation', hotspot: 'Hotspot-Square', button: 'square', slab: 2, side: -1 },
  { key: 'unified', hotspot: 'Hotspot-Circle', button: 'circle', slab: 2, side: 1 },
];

function CornerLight({
  platform,
  hotspot,
  button,
  slab,
  side,
}: {
  platform: PlatformKey;
  hotspot: string;
  button: HeroButtonKey;
  slab: 0 | 2;
  side: -1 | 1;
}) {
  const color = PLATFORM_COLORS[platform];
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const level = useRef(0);

  useFrame((_s, delta) => {
    const hovered = useButtonHotspotsStore.getState().glow[button] ? 1 : 0;
    const target = Math.max(pose.active[platform].current, hovered);
    level.current = THREE.MathUtils.lerp(level.current, target, 1 - Math.exp(-delta * 10));
    const l = level.current;
    core.current?.scale.setScalar(1 + l * 0.9);
    if (halo.current) {
      halo.current.scale.setScalar(1 + l * 1.4);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + l * 0.4;
    }
  });

  const x = side * 0.46;
  const y = slab === 0 ? 0.04 : -0.04;

  return (
    <group position={[x, y, SIZE / 2 + 0.02]}>
      <group name={hotspot}>
        <mesh ref={core}>
          <sphereGeometry args={[0.06, 20, 20]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={halo}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}


/** One platform's corner light + hologram, placed on the top or bottom row. */
function LightRig({ light, children }: { light: (typeof LIGHTS)[number]; children?: ReactNode }) {
  return (
    <>
      <CornerLight
        platform={light.key}
        hotspot={light.hotspot}
        button={light.button}
        slab={light.slab}
        side={light.side}
      />
      {/* Hologram authored in centi-units; scale into cube space. */}
      <group position={[light.side * 0.9, light.slab === 0 ? 0.5 : -0.5, 0.95]} scale={0.009}>
        <PlatformHologram
          position={[0, 0, 0]}
          color={PLATFORM_COLORS[light.key]}
          activeRef={pose.active[light.key]}
        />
      </group>
      {children}
    </>
  );
}

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
          <RoundedBox args={[SIZE, h, SIZE]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#2b2145" metalness={0.55} roughness={0.38} />
            <Edges threshold={20} color={EDGE_COLOR} lineWidth={1} />
          </RoundedBox>

          {i === 1 && (
            <mesh position={[0, 0, SIZE / 2 + 0.004]}>
              <planeGeometry args={[SCREEN_W, SCREEN_H]} />
              <meshBasicMaterial map={faceTexture} toneMapped={false} />
            </mesh>
          )}

          {LIGHTS.filter((light) => light.slab === i).map((light) => (
            <LightRig key={light.key} light={light} />
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * GLTF placeholder body. A single mesh cannot split, so `pose.spread` makes
 * the model breathe slightly and pushes the corner lights outward instead.
 */
function ModelBody({ faceTexture }: { faceTexture: THREE.Texture }) {
  const model = useRef<THREE.Group>(null);
  const rows = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    model.current?.scale.setScalar(1 + pose.spread * MODEL_BREATHE);
    const push = pose.spread * MODEL_PUSH;
    LIGHTS.forEach((light, i) => {
      const row = rows.current[i];
      if (!row) return;
      const up = light.slab === 0 ? 1 : -1;
      row.position.set(light.side * 0.46 * push, SLAB_Y[light.slab] + up * 0.47 * push, 0);
    });
  });

  return (
    <group>
      <group ref={model}>
        <CubeModel />
      </group>

      {/* Mounted round face screen: dark bezel, thin lilac rim, face texture. */}
      <mesh position={[0, 0, SIZE / 2 + 0.008]}>
        <circleGeometry args={[MODEL_SCREEN_R + 0.045, 64]} />
        <meshStandardMaterial color="#0a0814" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, SIZE / 2 + 0.011]}>
        <ringGeometry args={[MODEL_SCREEN_R + 0.008, MODEL_SCREEN_R + 0.018, 64]} />
        <meshBasicMaterial color="#d0bcff" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, SIZE / 2 + 0.012]}>
        <circleGeometry args={[MODEL_SCREEN_R, 64]} />
        <meshBasicMaterial map={faceTexture} toneMapped={false} />
      </mesh>

      {LIGHTS.map((light, i) => (
        <group
          key={light.key}
          ref={(el) => {
            rows.current[i] = el;
          }}
          position={[0, SLAB_Y[light.slab], 0]}
        >
          <LightRig light={light} />
        </group>
      ))}
    </group>
  );
}

export function AssistantCube() {
  const face = useFaceTexture(BODY === 'model' ? 'round' : 'wide');

  useFrame(({ clock }) => {
    const { emotion } = useAssistantStore.getState();
    face.update(clock.elapsedTime, emotion, pose.look, emotion !== 'sleep');
  });

  return BODY === 'model' ? (
    <ModelBody faceTexture={face.texture} />
  ) : (
    <ProceduralBody faceTexture={face.texture} />
  );
}

export default AssistantCube;
