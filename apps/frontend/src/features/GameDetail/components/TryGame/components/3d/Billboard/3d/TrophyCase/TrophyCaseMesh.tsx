import React, { useMemo, useState } from 'react';

import { Html, useGLTF } from '@react-three/drei';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as THREE from 'three';

import { useTrophyCaseControls } from './hooks/useTrophyCaseControls';
import { N64Cartridge } from './RotatingGameAsset';
import { TrophyCaseScreen } from './TrophyCaseScreen';
import { CollisionBoxHelper } from '../../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../../types/billboard';
import type { ArcadeControls } from '@/features/GameDetail/components/TryGame/types/input';
import type { Game } from '@repo/shared';

// ── Constants ─────────────────────────────────────────────────────────────────

const CASE_SCALE = 0.12;
const MESH_POSITION_OFFSET: [number, number, number] = [-8, -6, -8];
const ROTATION_Y_OFFSET = Math.PI / 2;
const SCREEN_OFFSET = { x: 0, y: 0.55, z: 0.35 } as const;

// Pushes the cartridge coordinate origin to float precisely within the center glass viewport
const ITEM_DISPLAY_OFFSET: [number, number, number] = [0, 1.0, 0];

const PROMPT_OFFSET = { x: 0, y: -0.15, z: 0.4 } as const;
const COLLISION_SIZE: [number, number, number] = [2.2, 1.2, 1.4];

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseMaterials extends Record<string, THREE.Material> {
  Element: THREE.Material;
}

interface TrophyCaseGLTFResult {
  nodes: {
    Object_2: THREE.Mesh;
  };
  materials: CaseMaterials;
}

interface TrophyCaseMeshProps extends Pick<BillboardConfig, 'position' | 'rotation'> {
  readonly isSelected?: boolean;
  readonly isNearby?: boolean;
  readonly games?: readonly Game[];
  readonly isLoading?: boolean;
  readonly isOpen?: boolean;
  readonly showPrompt?: boolean;
  readonly arcadeControlsRef: React.RefObject<ArcadeControls>;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TrophyCaseMesh: React.FC<TrophyCaseMeshProps> = ({
  position,
  rotation,
  isSelected = false,
  isNearby = false,
  games = [],
  isLoading = false,
  isOpen = false,
  showPrompt = false,
  arcadeControlsRef,
  onOpen,
  onClose,
}) => {
  const { nodes, materials } = useGLTF(
    '/models/trophy-case/scene.gltf',
  ) as unknown as TrophyCaseGLTFResult;

  const queryClient = useQueryClient();
  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const currentGame = games[activeIndex];

  // Navigate through your completed collection array smoothly using your hook
  useTrophyCaseControls({
    arcadeControlsRef,
    gamesCount: games.length,
    isOpen,
    onPrev: () => setActiveIndex((prev) => (prev === 0 ? games.length - 1 : prev - 1)),
    onNext: () => setActiveIndex((prev) => (prev === games.length - 1 ? 0 : prev + 1)),
    onClose: () => {
      if (onClose) onClose();
    },
  });

  const caseMaterial = useMemo(() => {
    const mat = materials.Element.clone() as THREE.MeshStandardMaterial;
    if (isSelected) {
      mat.emissive.set('#fbbf24');
      mat.emissiveIntensity = 0.3;
    } else if (isNearby) {
      mat.emissive.set('#10b981');
      mat.emissiveIntensity = 0.1;
    } else {
      mat.emissiveIntensity = 0;
    }
    return mat;
  }, [materials.Element, isSelected, isNearby]);

  return (
    <group position={position as [number, number, number]} rotation={rotationArray}>
      {/* Structural Framework Model */}
      <group scale={[CASE_SCALE, CASE_SCALE, CASE_SCALE]} rotation={[0, ROTATION_Y_OFFSET, 0]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_2.geometry}
          material={caseMaterial}
          position={MESH_POSITION_OFFSET}
          rotation={[-Math.PI / 2, 0, -Math.PI]}
        />
      </group>

      {/* ── Showcase Interior Illumination Engine ── */}
      {games.length > 0 && (
        <group position={[0, 1.6, 0]}>
          {/* Subtle physical fixture disc at the top roof of the display cabinet */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.2, 16]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>

          {/* Focused downlight spotlight targetting the spinning cartridge */}
          <spotLight
            castShadow
            intensity={4.5}
            distance={2.5}
            angle={Math.PI / 4}
            penumbra={0.6}
            color="#ffffff"
            position={[0, 0, 0]}
            target-position={[0, -0.6, 0]}
          />

          {/* Ambient bounce to ensure the cartridge details are crisp from all angles */}
          <pointLight intensity={0.8} distance={1.5} color="#34d399" position={[0, -0.4, 0.2]} />
        </group>
      )}

      {/* ── Centerpiece Dynamic Trophy Display ── */}
      {games.length > 0 && (
        <group position={ITEM_DISPLAY_OFFSET}>
          <N64Cartridge game={currentGame} />

          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshBasicMaterial color="red" wireframe />
          </mesh>
        </group>
      )}

      {/* HUD Panel Engine */}
      <group position={[SCREEN_OFFSET.x, SCREEN_OFFSET.y, SCREEN_OFFSET.z]}>
        <Html
          transform
          occlude
          distanceFactor={1.1}
          style={{
            width: '600px',
            height: '450px',
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
        >
          <QueryClientProvider client={queryClient}>
            <TrophyCaseScreen
              games={games}
              isLoading={isLoading}
              isOpen={isOpen}
              isSelected={isSelected}
              arcadeControlsRef={arcadeControlsRef}
              onOpen={onOpen}
              onClose={onClose}
            />
          </QueryClientProvider>
        </Html>
      </group>

      {/* Driver action hint layout */}
      {showPrompt && games.length > 0 && (
        <Html
          position={[PROMPT_OFFSET.x, PROMPT_OFFSET.y, PROMPT_OFFSET.z]}
          transform
          occlude
          style={{ width: '240px', pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 14px',
              borderRadius: '999px',
              border: '1px solid #10b981',
              background: '#10b98118',
              color: '#34d399',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            ⚡ Press E · View
          </div>
        </Html>
      )}

      {/* Environment Glow Elements */}
      {isNearby && (
        <mesh position={[0, 0.5, -0.1]}>
          <planeGeometry args={[2.8, 1.6]} />
          <meshStandardMaterial
            color="#10b981"
            transparent
            opacity={0.07}
            emissive="#10b981"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[1.4, 32]} />
        <meshStandardMaterial
          color="#10b981"
          transparent
          opacity={isSelected ? 0.22 : isNearby ? 0.14 : 0.06}
          emissive="#10b981"
          emissiveIntensity={0.2}
          depthWrite={false}
        />
      </mesh>

      <CollisionBoxHelper
        position={[0, COLLISION_SIZE[1] / 2, 0]}
        size={COLLISION_SIZE}
        color="#10b981"
      />
    </group>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function preloadTrophyCase(): void {
  useGLTF.preload('/models/trophy-case/scene.gltf');
}
