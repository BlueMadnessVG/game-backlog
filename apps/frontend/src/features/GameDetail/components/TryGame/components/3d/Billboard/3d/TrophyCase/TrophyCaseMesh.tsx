// components/3d/Billboard/3d/TrophyCase/TrophyCaseMesh.tsx
/**
 * Collector's Display Case — "Completed" category structure.
 *
 * Author:  Kevin Mar  https://sketchfab.com/Taiyaki1199
 * License: CC-BY-4.0  http://creativecommons.org/licenses/by/4.0/
 * Source:  https://sketchfab.com/3d-models/collectors-display-case-gotg-mission-breakout-7144957c6f8f46bb8c0ea14a4ebdda75
 *
 * ── Asset setup ────────────────────────────────────────────────────────────
 * Download the model from Sketchfab (Auto-converted glTF) and place all
 * files under:   public/models/trophy-case/
 * Entry point:   public/models/trophy-case/scene.gltf
 * ──────────────────────────────────────────────────────────────────────────
 *
 * ── Model structure ────────────────────────────────────────────────────────
 * Single mesh  : nodes.Object_2
 * Single material: materials.Element
 * Baked offset : position=[-16.008, 0, -15.992], rotation=[-PI/2, 0, -PI]
 *   The offset is the mesh's internal origin baked in at export.
 *   We counteract it with MESH_POSITION_OFFSET so the case sits at the
 *   group origin (makes it easy to place in the world via the outer group).
 *
 * ── Html overlay positioning ──────────────────────────────────────────────
 * All offsets are in the case's LOCAL space (BEFORE the billboard's world
 * rotation is applied by the outer group).
 *
 * After applying CASE_SCALE and accounting for the baked rotation, the
 * display case stands upright. The glass cabinet section is the upper half.
 * The screen overlay sits inside/in front of the glass section.
 *
 * Tuning guide — if overlays don't align after loading the model:
 *   SCREEN_OFFSET.y   — raise/lower to move into the glass section
 *   SCREEN_OFFSET.z   — increase to push forward (prevent z-fighting)
 *   CASE_SCALE        — change if model appears too large or too small
 *   ROTATION_Y_OFFSET — flip by PI if the case faces backward
 */

import React, { useMemo } from 'react';

import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { TrophyCaseScreen } from './TrophyCaseScreen';
import { CollisionBoxHelper } from '../../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../../types/billboard';
import type { ArcadeControls } from '../../../../../types/input';
import type { Game } from '@repo/shared';

// ── Layout constants ──────────────────────────────────────────────────────

/**
 * Uniform scale.
 * The model position offset values (~16 units) suggest export in decimetres
 * or a custom unit. Start with 0.1 and tune visually.
 * At 0.1: each model unit = 10cm → case ≈ reasonable real-world size.
 */
const CASE_SCALE = 0.1;

/**
 * Counter-offset for the mesh's baked position [-16.008, 0, -15.992].
 * Applied to the mesh (not the group) so the case centre aligns with the
 * group origin. Multiply baked values by -1.
 */
const MESH_POSITION_OFFSET: [number, number, number] = [16.008, 0, 15.992];

/**
 * Y rotation applied to the outer group to align the case face with the
 * billboard's forward direction (+Z in this project).
 * The baked rotation [-PI/2, 0, -PI] leaves the front facing +X after
 * CASE_SCALE — so we rotate +PI/2 to bring it to +Z.
 * Flip to -PI/2 or Math.PI if the case faces backward.
 */
const ROTATION_Y_OFFSET = Math.PI / 2;

/**
 * Screen overlay position inside the glass cabinet (local space, post-scale).
 *   y: upper portion of the case (glass section centre)
 *   z: slightly in front of the glass face
 */
const SCREEN_OFFSET = { x: 0, y: 0.55, z: 0.35 } as const;

/**
 * Interaction prompt position — floats below the case.
 */
const PROMPT_OFFSET = { x: 0, y: -0.15, z: 0.4 } as const;

/**
 * Approximate collision box [width, height, depth] in world units at CASE_SCALE.
 * The wooden base is wider; the glass box is narrower. One box covers both.
 * Tune with CollisionBoxHelper visible.
 */
const COLLISION_SIZE: [number, number, number] = [2.2, 1.2, 1.4];

// ── Material type ─────────────────────────────────────────────────────────

interface CaseMaterials extends Record<string, THREE.Material> {
  Element: THREE.Material;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface TrophyCaseMeshProps extends Pick<BillboardConfig, 'position' | 'rotation'> {
  readonly isSelected?: boolean;
  readonly isNearby?: boolean;
  readonly games?: readonly Game[];
  readonly isLoading?: boolean;
  readonly isOpen?: boolean;
  readonly showPrompt?: boolean;
  readonly arcadeControlsRef?: React.RefObject<ArcadeControls>;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

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
  const { nodes, materials } = useGLTF('/models/trophy-case/scene.gltf') as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: CaseMaterials;
  };

  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  // Clone + tint the material when nearby/selected so it glows gold.
  // We clone so other instances don't inherit the emissive change.
  const caseMaterial = useMemo(() => {
    const mat = materials.Element.clone() as THREE.MeshStandardMaterial;
    if (isSelected) {
      mat.emissive.set('#fbbf24');
      mat.emissiveIntensity = 0.3;
    } else if (isNearby) {
      mat.emissive.set('#10b981'); // green-gold for "completed"
      mat.emissiveIntensity = 0.1;
    } else {
      mat.emissiveIntensity = 0;
    }
    return mat;
  }, [materials.Element, isSelected, isNearby]);

  return (
    <group position={position as [number, number, number]} rotation={rotationArray}>
      {/* ── Outer orientation wrapper ──────────────────────────────────
          Applies CASE_SCALE and ROTATION_Y_OFFSET so the case face
          points toward the player (+Z in this project).              */}
      <group scale={[CASE_SCALE, CASE_SCALE, CASE_SCALE]} rotation={[0, ROTATION_Y_OFFSET, 0]}>
        {/* ── Physical mesh ──────────────────────────────────────────
            The mesh has a baked position/rotation from the Sketchfab
            export. MESH_POSITION_OFFSET cancels the baked position so
            the case centre sits at the group origin.                 */}
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_2.geometry}
          material={caseMaterial}
          position={MESH_POSITION_OFFSET}
          rotation={[-Math.PI / 2, 0, -Math.PI]}
        />
      </group>

      {/* ── Screen overlay ─────────────────────────────────────────────
          Positioned at SCREEN_OFFSET in world-local space (OUTSIDE the
          scale group so pixel dimensions are in world units, not model
          units). TrophyCaseScreen manages all display states.        */}
      <group position={[SCREEN_OFFSET.x, SCREEN_OFFSET.y, SCREEN_OFFSET.z]}>
        <TrophyCaseScreen
          games={games}
          isLoading={isLoading}
          isOpen={isOpen}
          isSelected={isSelected}
          arcadeControlsRef={arcadeControlsRef}
          onOpen={onOpen}
          onClose={onClose}
        />
      </group>

      {/* ── Interaction prompt ─────────────────────────────────────────
          Floats below the case, visible when the car is in range.    */}
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

      {/* ── Proximity glow ─────────────────────────────────────────────
          Soft green-gold halo behind the case when the car is nearby. */}
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

      {/* ── Ground light pool ─────────────────────────────────────────── */}
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

      {/* ── Collision box helper (debug) ───────────────────────────────── */}
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
