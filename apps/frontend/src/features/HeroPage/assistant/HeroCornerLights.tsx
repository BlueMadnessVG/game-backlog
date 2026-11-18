import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { platformActive } from '../components/3d/platformActivation';
import { useButtonHotspotsStore, type HeroButtonKey } from '../store/heroButtonHotspots.Store';
import { PLATFORM_COLORS, type PlatformKey } from '../utils/platformColors';

import { pose } from '@/common/components/layout/Assistant';

/**
 * The hero's accessory for the app-wide cube: four glowing platform lights on
 * the cube's front corners (registered with useAssistantAccessory, rendered in
 * the cube body's space). Each light glows while its platform is on stage
 * (`platformActive`, from the hero director) or its hotspot is hovered, and is
 * pushed outward as the body spreads.
 *
 * Each light carries a `Hotspot-*` object that ButtonProjector projects into
 * the clickable hotspot overlay.
 *
 * Exports:
 *  - HeroCornerLights (default export too).
 */
const FRONT_Z = 0.6;
const ROW_Y = { top: 0.43, bottom: -0.43 } as const;
/** How far the lights move outward at full spread, as a fraction. */
const PUSH = 0.35;

/** Which row + corner each platform's light sits on. */
const LIGHTS: {
  key: PlatformKey;
  hotspot: string;
  button: HeroButtonKey;
  row: 'top' | 'bottom';
  side: -1 | 1;
}[] = [
  { key: 'steam', hotspot: 'Hotspot-Cross', button: 'cross', row: 'top', side: -1 },
  { key: 'xbox', hotspot: 'Hotspot-Triangle', button: 'triangle', row: 'top', side: 1 },
  { key: 'playstation', hotspot: 'Hotspot-Square', button: 'square', row: 'bottom', side: -1 },
  { key: 'unified', hotspot: 'Hotspot-Circle', button: 'circle', row: 'bottom', side: 1 },
];

/** One platform's glowing corner light. */
function CornerLight({ light }: { light: (typeof LIGHTS)[number] }) {
  const { key: platform, hotspot, button, row, side } = light;
  const color = PLATFORM_COLORS[platform];
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const level = useRef(0);

  useFrame((_s, delta) => {
    const hovered = useButtonHotspotsStore.getState().glow[button] ? 1 : 0;
    const target = Math.max(platformActive[platform].current, hovered);
    level.current = THREE.MathUtils.lerp(level.current, target, 1 - Math.exp(-delta * 10));
    const l = level.current;
    core.current?.scale.setScalar(1 + l * 0.9);
    if (halo.current) {
      halo.current.scale.setScalar(1 + l * 1.4);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + l * 0.4;
    }
  });

  const x = side * 0.46;
  const y = row === 'top' ? 0.04 : -0.04;

  return (
    <group position={[x, y, FRONT_Z + 0.02]}>
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

export function HeroCornerLights() {
  const rows = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const push = pose.spread * PUSH;
    LIGHTS.forEach((light, i) => {
      const row = rows.current[i];
      if (!row) return;
      const up = light.row === 'top' ? 1 : -1;
      row.position.set(light.side * 0.46 * push, ROW_Y[light.row] + up * 0.47 * push, 0);
    });
  });

  return (
    <>
      {LIGHTS.map((light, i) => (
        <group
          key={light.key}
          ref={(el) => {
            rows.current[i] = el;
          }}
          position={[0, ROW_Y[light.row], 0]}
        >
          <CornerLight light={light} />
        </group>
      ))}
    </>
  );
}

export default HeroCornerLights;
