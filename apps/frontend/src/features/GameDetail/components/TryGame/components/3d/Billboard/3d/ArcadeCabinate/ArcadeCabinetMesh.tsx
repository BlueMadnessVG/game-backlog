// components/3d/Billboard/3d/ArcadeCabinetMesh.tsx
/**
 * 3D Arcade Cabinet — "Playing" category display structure.
 *
 * Author:  DIWAD  https://sketchfab.com/DIWAD
 * License: CC-BY-4.0  http://creativecommons.org/licenses/by/4.0/
 * Source:  https://sketchfab.com/3d-models/arcade-machine-ccb3867144af4c40991f23b011736fae
 *
 * ── Asset setup ────────────────────────────────────────────────────────────
 * Download the model from Sketchfab (Auto-converted glTF) and place all
 * files under:   public/models/arcade/
 * Entry point:   public/models/arcade/scene.gltf
 * ──────────────────────────────────────────────────────────────────────────
 *
 * ── Why a dedicated component instead of reusing Billboard? ───────────────
 * The flat-panel Billboard uses a box mesh + Html overlay sized to match
 * that box. The arcade cabinet is a real GLTF mesh with its own proportions,
 * tilt, and internal screen position. Merging the two into one component
 * would require conditionals across every measurement. A separate component
 * (OCP) keeps each structure self-contained and independently tunable.
 *
 * ── Html overlay positioning ──────────────────────────────────────────────
 * The GLTF has a single mesh (no separate screen node), so we position
 * Html overlays manually using the constants below. All offsets are in the
 * cabinet's LOCAL space after the outer group's rotation is applied.
 *
 * Coordinate system (cabinet local, model exported upright):
 *   +Y = up along the cabinet body
 *   +Z = toward the player (front face of the cabinet)
 *   +X = cabinet's right side
 *
 * Tuning guide — if overlays don't align:
 *   SCREEN_OFFSET.y  — raise/lower to move screen up or down on the cabinet
 *   SCREEN_OFFSET.z  — increase to push screen forward (prevent z-fighting)
 *   MARQUEE_OFFSET.y — raise/lower the top light strip text
 *   CABINET_SCALE    — uniform scale if the model is too large or too small
 *                      (exported in mm → set to 0.01; exported in m → 1.0)
 */

import React, { useMemo } from 'react';

import { Html, useGLTF } from '@react-three/drei';

import { ArcadeScreen } from './ArcadeScreen';
import { CollisionBoxHelper } from '../../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../../types/billboard';
import type { Game } from '@repo/shared';
import type * as THREE from 'three';

// ── Layout constants — tune these to align overlays with the mesh ─────────

/**
 * Uniform scale applied to the cabinet mesh.
 * Sketchfab "Auto-converted glTF" is typically exported in meters,
 * so 1.0 keeps the model at real-world size (~1.8 m tall).
 * If the cabinet looks giant, try 0.01 (millimetre export).
 */
const CABINET_SCALE = 1.0;

/**
 * Screen overlay position in cabinet local space.
 *   y = 0.18  → roughly 60 % up a 1.8 m cabinet (screen centre)
 *   z = 0.36  → slightly proud of the front face to prevent z-fighting
 * The screen is also tilted back ~8° to follow the physical screen angle.
 */
const SCREEN_OFFSET = { x: 0, y: 0.18, z: 0.36 } as const;
const SCREEN_TILT_X = -0.14; // radians — matches the cabinet's screen lean

/**
 * Marquee (top light strip) overlay position.
 *   y = 0.72  → near the top of a 1.8 m cabinet
 *   z = 0.29  → flush with the marquee face
 */
const MARQUEE_OFFSET = { x: 0, y: 0.72, z: 0.29 } as const;

/**
 * Interaction prompt position — floats below the control panel.
 *   y = -0.55 → below the joystick area
 *   z = 0.38  → in front of the cabinet face
 */
const PROMPT_OFFSET = { x: 0, y: -0.55, z: 0.38 } as const;

/**
 * Approximate collision box dimensions for this cabinet at CABINET_SCALE 1.0.
 * Width × Height × Depth in world units (metres).
 * Adjust if CABINET_SCALE changes.
 */
const COLLISION_SIZE: [number, number, number] = [0.85, 1.9, 0.75];

// ── Node / material types ─────────────────────────────────────────────────

interface ArcadeNodes extends Record<string, THREE.Object3D> {
  defaultMaterial: THREE.Mesh;
}

interface ArcadeMaterials extends Record<string, THREE.Material> {
  Arcade_machine: THREE.Material;
}

// ── Component ─────────────────────────────────────────────────────────────

interface ArcadeCabinetMeshProps extends Pick<BillboardConfig, 'position' | 'rotation'> {
  readonly isSelected?: boolean;
  readonly isNearby?: boolean;
  readonly games?: readonly Game[];
  readonly isLoading?: boolean;
  readonly isOpen?: boolean;
  readonly showPrompt?: boolean;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

export const ArcadeCabinetMesh: React.FC<ArcadeCabinetMeshProps> = ({
  position,
  rotation,
  isSelected = false,
  isNearby = false,
  games = [],
  isLoading = false,
  isOpen = false,
  showPrompt = false,
  onOpen,
  onClose,
}) => {
  const { nodes, materials } = useGLTF('/models/arcade/scene.gltf') as unknown as {
    nodes: ArcadeNodes;
    materials: ArcadeMaterials;
  };

  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  // Emissive tint on the cabinet trim material when nearby / selected.
  // We clone the material so other instances are not affected.
  const cabinetMaterial = useMemo(() => {
    const mat = materials.Arcade_machine.clone() as THREE.MeshStandardMaterial;
    if (isSelected) {
      mat.emissive.set('#fbbf24');
      mat.emissiveIntensity = 0.25;
    } else if (isNearby) {
      mat.emissive.set('#f97316'); // warm orange for "playing"
      mat.emissiveIntensity = 0.1;
    } else {
      mat.emissiveIntensity = 0;
    }
    return mat;
  }, [materials.Arcade_machine, isSelected, isNearby]);

  return (
    <group position={position as [number, number, number]} rotation={rotationArray}>
      {/* ── Physical cabinet mesh ────────────────────────────────────────
          The GLTF was generated with an outer group rotation [-PI/2,0,0]
          and the mesh itself has rotation [PI/2,0,0].  These cancel to
          identity, so the cabinet stands upright in world space.         */}
      <group rotation={[-Math.PI / 2, 0, 0]} scale={[CABINET_SCALE, CABINET_SCALE, CABINET_SCALE]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.defaultMaterial.geometry}
          material={cabinetMaterial}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

      {/* ── Marquee strip (top light bar) ────────────────────────────────
          Positioned at MARQUEE_OFFSET in cabinet local space.
          The Html is non-interactive (pointer-events: none) so it never
          blocks the player from driving through the scene.               */}
      <Html
        position={[MARQUEE_OFFSET.x, MARQUEE_OFFSET.y, MARQUEE_OFFSET.z]}
        transform
        occlude
        style={{
          width: '220px',
          pointerEvents: 'none',
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(90deg, #1e0a3c 0%, #3b0764 50%, #1e0a3c 100%)',
            border: '2px solid #f97316',
            borderRadius: '4px',
            padding: '4px 12px',
            color: '#fb923c',
            fontFamily: '"Press Start 2P", monospace, sans-serif',
            fontSize: '10px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textShadow: '0 0 8px #f97316',
            boxShadow: '0 0 12px #f9731640, inset 0 0 8px #f9731620',
          }}
        >
          NOW PLAYING
        </div>
      </Html>

      {/* ── Screen overlay ───────────────────────────────────────────────
          Sits at SCREEN_OFFSET with a slight backward tilt to follow the
          physical screen angle of the cabinet model.
          ArcadeScreen handles all state variations (idle / open / loading). */}
      <group
        position={[SCREEN_OFFSET.x, SCREEN_OFFSET.y, SCREEN_OFFSET.z]}
        rotation={[SCREEN_TILT_X, 0, 0]}
      >
        <ArcadeScreen
          games={games}
          isLoading={isLoading}
          isOpen={isOpen}
          isSelected={isSelected}
          onOpen={onOpen}
          onClose={onClose}
        />
      </group>

      {/* ── Interaction prompt ───────────────────────────────────────────
          Only rendered when the car is within interaction distance AND
          there are games to show.  showPrompt is controlled by Billboards3D.*/}
      {showPrompt && games.length > 0 && (
        <Html
          position={[PROMPT_OFFSET.x, PROMPT_OFFSET.y, PROMPT_OFFSET.z]}
          transform
          occlude
          style={{
            width: '260px',
            pointerEvents: 'none',
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              border: '1px solid #f97316',
              background: '#f9731618',
              color: '#fb923c',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span style={{ animation: 'pulse 1.5s infinite' }}>⚡</span>
            Press E · View
          </div>
        </Html>
      )}

      {/* ── Proximity glow ───────────────────────────────────────────────
          A soft orange halo plane behind the cabinet when nearby.        */}
      {isNearby && (
        <mesh position={[0, 0.5, -0.1]}>
          <planeGeometry args={[1.4, 2.2]} />
          <meshStandardMaterial
            color="#f97316"
            transparent
            opacity={0.08}
            emissive="#f97316"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {/* ── Ground light pool ────────────────────────────────────────────
          A coloured decal on the ground under the cabinet.
          Always shown — brightens when nearby / selected.               */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[1.1, 32]} />
        <meshStandardMaterial
          color="#f97316"
          transparent
          opacity={isSelected ? 0.22 : isNearby ? 0.14 : 0.07}
          emissive="#f97316"
          emissiveIntensity={0.2}
          depthWrite={false}
        />
      </mesh>

      {/* ── Collision box helper (debug, always visible in dev) ──────── */}
      <CollisionBoxHelper
        position={[0, COLLISION_SIZE[1] / 2, 0]}
        size={COLLISION_SIZE}
        color="#f97316"
      />
    </group>
  );
};

// Pre-warm the asset loader so the model is ready before mounting.
// eslint-disable-next-line react-refresh/only-export-components
export function preloadArcadeCabinet(): void {
  useGLTF.preload('/models/arcade/scene.gltf');
}
