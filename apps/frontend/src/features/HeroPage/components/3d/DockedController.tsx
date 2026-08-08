import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import {
  usePageProgressStore,
  getActiveRange,
} from '../../store/pageProgress.Store';
import {
  PS_BLUE,
  STEAM_BLUE,
  UNIFIED_AMBER,
  XBOX_GREEN,
} from '../../utils/platformColors';
import { SECTIONS } from '../../utils/sections';

import type { HeroButtonKey } from '../../store/heroButtonHotspots.Store';

const BUTTON_KEYS: HeroButtonKey[] = ['square', 'triangle', 'cross', 'circle'];

const BUTTON_COLORS: Record<HeroButtonKey, string> = {
  square: PS_BLUE,
  triangle: XBOX_GREEN,
  cross: STEAM_BLUE,
  circle: UNIFIED_AMBER,
};

const BUTTON_POS: Record<HeroButtonKey, [number, number, number]> = {
  cross: [0, -1.15, 0],
  circle: [1.15, 0, 0],
  square: [-1.15, 0, 0],
  triangle: [0, 1.15, 0],
};

function DockButton({
  buttonKey,
  glowRef,
}: {
  buttonKey: HeroButtonKey;
  glowRef: React.RefObject<Record<HeroButtonKey, number>>;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const material = matRef.current;
    if (!material || !glowRef.current) return;
    const g = glowRef.current[buttonKey];
    material.emissive.copy(material.color).multiplyScalar(g * 0.9);
  });

  return (
    <group position={BUTTON_POS[buttonKey]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
        <meshStandardMaterial
          ref={matRef}
          color={BUTTON_COLORS[buttonKey]}
          roughness={0.35}
          metalness={0.5}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[0.55, 0.62, 32]} />
        <meshBasicMaterial
          color={BUTTON_COLORS[buttonKey]}
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Compact, procedural controller-face rendered by the docked corner HUD.
 * The four platform-coloured buttons in a diamond carry the controller's
 * identity at small size; the chapter→button glow is driven by the global
 * page-progress store so the HUD tracks the active chapter without re-renders.
 */
export function DockedController() {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<Record<HeroButtonKey, number>>({
    square: 0,
    triangle: 0,
    cross: 0,
    circle: 0,
  });
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    const { progress, chapters } = usePageProgressStore.getState();
    const range = getActiveRange(progress, chapters);
    const chapter = range ? SECTIONS.find((s) => s.id === range.id) : undefined;
    const target = chapter?.button;

    const k = 1 - Math.exp(-8 * delta);
    for (const key of BUTTON_KEYS) {
      glow.current[key] += (target === key ? 1 - glow.current[key] : -glow.current[key]) * k;
    }

    if (group.current) {
      group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.06;
      group.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.04;
    }

    if (lightRef.current) {
      lightRef.current.color.set(chapter?.accent ?? '#ffffff');
      lightRef.current.intensity = 1.5 + (chapter ? 4.5 : 0);
    }
  });

  return (
    <group ref={group} rotation={[0.15, -0.3, 0]}>
      <pointLight
        ref={lightRef}
        position={[0, 0, 2.4]}
        intensity={1.5}
        distance={8}
        color="#ffffff"
      />

      <mesh position={[0, 0, -0.14]}>
        <circleGeometry args={[2.1, 48]} />
        <meshBasicMaterial color="#101014" transparent opacity={0.85} toneMapped={false} />
      </mesh>

      <mesh position={[0, 0, -0.1]}>
        <torusGeometry args={[2.05, 0.02, 8, 64]} />
        <meshBasicMaterial color="#3a3a42" toneMapped={false} />
      </mesh>

      {BUTTON_KEYS.map((key) => (
        <DockButton key={key} buttonKey={key} glowRef={glow} />
      ))}
    </group>
  );
}
