// components/3d/Billboard/3d/TrophyCase/TrophyCaseMesh.tsx
/**
 * Trophy Case mesh + overlays for the "Completed" category.
 *
 * ── Index ownership ───────────────────────────────────────────────────────
 * activeIndex lives HERE — it is the single source of truth for:
 *   1. Which game the N64Cartridge displays (3D object)
 *   2. Which game TrophyCaseScreen shows (Html overlay)
 *
 * Previously TrophyCaseMesh had its own index AND TrophyCaseScreen had a
 * separate carouselIndex, causing them to drift out of sync.
 * The fix: useTrophyCaseControls is called ONLY here; TrophyCaseScreen
 * receives activeIndex as a prop and never manages its own.
 */

import React, { useMemo, useState } from 'react';

import { Html, useGLTF } from '@react-three/drei';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as THREE from 'three';

import { useTrophyCaseControls } from './hooks/useTrophyCaseControls';
import { N64Cartridge } from './RotatingGameAsset';
import { TrophyCaseScreen } from './TrophyCaseScreen';
import { CollisionBoxHelper } from '../../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../../types/billboard';
import type { ArcadeControls } from '../../../../../types/input';
import type { Game } from '@repo/shared';

// ── Layout constants ───────────────────────────────────────────────────────

const CASE_SCALE = 0.12;
const MESH_POSITION_OFFSET: [number, number, number] = [-8, -6, -8];
const ROTATION_Y_OFFSET = Math.PI / 2;
const SCREEN_OFFSET = { x: 0, y: 0.55, z: 0.35 } as const;
const ITEM_DISPLAY_OFFSET: [number, number, number] = [0, 1.0, 0];
const PROMPT_OFFSET = { x: 0, y: -0.15, z: 0.4 } as const;
const COLLISION_SIZE: [number, number, number] = [2.2, 1.2, 1.4];

// ── Types ──────────────────────────────────────────────────────────────────

interface CaseMaterials extends Record<string, THREE.Material> {
  Element: THREE.Material;
}

interface TrophyCaseGLTFResult {
  nodes: { Object_2: THREE.Mesh };
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
  const { nodes, materials } = useGLTF(
    '/models/trophy-case/scene.gltf',
  ) as unknown as TrophyCaseGLTFResult;

  const queryClient = useQueryClient();
  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  // ── Single source of truth for the active game index ─────────────────────
  // Controls BOTH the 3D cartridge displayed inside the case AND the
  // Html screen overlay. One index, two consumers.
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => setActiveIndex((i) => (i === 0 ? games.length - 1 : i - 1));
  const handleNext = () => setActiveIndex((i) => (i === games.length - 1 ? 0 : i + 1));
  const handleClose = () => onClose?.();

  // Arrow keys + Escape routed here — NOT in TrophyCaseScreen
  useTrophyCaseControls({
    arcadeControlsRef,
    gamesCount: games.length,
    isOpen,
    onPrev: handlePrev,
    onNext: handleNext,
    onClose: handleClose,
  });

  const currentGame = games[activeIndex];

  // Material tint for proximity / selection glow
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
      {/* ── GLTF mesh ───────────────────────────────────────────────── */}
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

      {/* ── Interior lighting ───────────────────────────────────────── */}
      {games.length > 0 && (
        <group position={[0, 1.6, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.2, 16]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
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
          <pointLight intensity={0.8} distance={1.5} color="#34d399" position={[0, -0.4, 0.2]} />
        </group>
      )}

      {/* ── Rotating cartridge — driven by activeIndex ──────────────── */}
      {games.length > 0 && (
        <group position={ITEM_DISPLAY_OFFSET}>
          <N64Cartridge game={currentGame} />
        </group>
      )}

      {/* ── Html screen — receives activeIndex, never manages its own ── */}
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
          {/*
            QueryClientProvider re-provided here because <Html> severs
            React context (same pattern as ArcadeCabinetMesh).
          */}
          <QueryClientProvider client={queryClient}>
            <TrophyCaseScreen
              games={games}
              isLoading={isLoading}
              isOpen={isOpen}
              isSelected={isSelected}
              activeIndex={activeIndex} // ← single source of truth
              onOpen={onOpen}
              onClose={handleClose}
              onPrev={handlePrev} // ← callbacks from THIS component
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
  useGLTF.preload('/models/trophy-case/scene.gltf');
}
