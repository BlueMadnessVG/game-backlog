// components/3d/Billboard/3d/TrophyCase/TrophyCaseMesh.tsx
/**
 * Trophy Case mesh + overlays for the "Completed" category.
 *
 * ── Index ownership ───────────────────────────────────────────────────────
 * activeIndex lives HERE — it is the single source of truth for:
 * 1. Which game the N64Cartridge displays (3D object)
 * 2. Which game TrophyCaseScreen shows (Html overlay)
 */

import React, { useMemo, useState } from 'react';

import { Html, useGLTF } from '@react-three/drei';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as THREE from 'three';

import { useTrophyCaseControls } from './hooks/useTrophyCaseControls';
import { N64Cartridge } from './N64Cartridge';
import { TrophyCaseScreen } from './TrophyCaseScreen';
import { CollisionBoxHelper } from '../../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../../types/billboard';
import type { ArcadeControls } from '../../../../../types/input';
import type { Game } from '@repo/shared';

// ── Layout constants ───────────────────────────────────────────────────────
// NOTE: You may need to tweak these offsets to visually align with the new Rack model shelves!
const CASE_SCALE = 0.12;
const ROTATION_Y_OFFSET = -Math.PI / 1.62;
const SCREEN_OFFSET = { x: 0, y: 0.55, z: 0.35 } as const;
const ITEM_DISPLAY_OFFSET: [number, number, number] = [0, 0, 0];
const PROMPT_OFFSET = { x: 0, y: -0.15, z: 0.4 } as const;
const COLLISION_SIZE: [number, number, number] = [0, 0, 0];

// ── Types for the new Rack Model ──────────────────────────────────────────

interface RackMaterials extends Record<string, THREE.Material> {
  'Material.001': THREE.Material;
  'Material.002': THREE.Material;
  'Material.003': THREE.Material;
}

interface RackGLTFResult {
  nodes: {
    Cube_Material001_0: THREE.Mesh;
    Cube001_Material002_0: THREE.Mesh;
    Cube003_Material002_0: THREE.Mesh;
    Plane_Material003_0: THREE.Mesh;
  };
  materials: RackMaterials;
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

// ── Component ──────────────────────────────────────────────────────────────

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
  // Update path to your new GLTF model file
  const { nodes, materials } = useGLTF(
    '/models/trophy-case/scene.gltf', // Adjust this string to your new public asset path
  ) as unknown as RackGLTFResult;

  const queryClient = useQueryClient();
  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  // ── Single source of truth for the active game index ─────────────────────
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => setActiveIndex((i) => (i === 0 ? games.length - 1 : i - 1));
  const handleNext = () => setActiveIndex((i) => (i === games.length - 1 ? 0 : i + 1));
  const handleClose = () => onClose?.();

  useTrophyCaseControls({
    arcadeControlsRef,
    gamesCount: games.length,
    isOpen,
    onPrev: handlePrev,
    onNext: handleNext,
    onClose: handleClose,
  });

  const currentGame = games[activeIndex];

  return (
    <group position={position as [number, number, number]} rotation={rotationArray}>
      {/* ── NEW GLTF MESH (Rack Model) ─────────────────────────────────── */}
      <group
        scale={[CASE_SCALE, CASE_SCALE, CASE_SCALE]}
        position={[0, -0.7, 0]}
        rotation={[0, ROTATION_Y_OFFSET, 0]}
      >
        <group scale={0.11}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Cube_Material001_0.geometry}
            material={materials['Material.001']}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={100}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Cube001_Material002_0.geometry}
            material={materials['Material.002']}
            position={[0, 131.029, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={100}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Cube003_Material002_0.geometry}
            material={materials['Material.002']}
            position={[-66.274, 263.124, -105.715]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={69.164}
          />
        </group>
      </group>

      {/* ── Rotating cartridge — driven by activeIndex ──────────────── */}
      {games.length > 0 && (
        <group position={ITEM_DISPLAY_OFFSET}>
          <N64Cartridge game={currentGame} />
        </group>
      )}

      {/* ── Html screen — receives activeIndex ──────────────────────── */}
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
              activeIndex={activeIndex}
              onOpen={onOpen}
              onClose={handleClose}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          </QueryClientProvider>
        </Html>
      </group>

      {/* ── Prompt ──────────────────────────────────────────────────── */}
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

      {/* ── Environment ─────────────────────────────────────────────── */}
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
  // Update preload path to match your new model path
  useGLTF.preload('/models/trophy-case/scene.gltf');
}
