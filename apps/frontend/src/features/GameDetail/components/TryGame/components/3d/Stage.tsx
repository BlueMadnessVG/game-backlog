import React, { useRef } from 'react';

import * as THREE from 'three';

import { Billboards3D } from './Billboard/3d/Billboards3D';
import { BILLBOARD_COLLIDERS } from './Billboard/3d/colliderConfigs';
import { CameraController } from './CameraControlller';
import { Car } from './Car/Car';
import { useCameraMode } from '../../hooks/useCameraMode';
import { useInputRouter } from '../../hooks/useInputerRouter';
import { DEFAULT_PHYSICS_CONFIG } from '../../types/vehicle';

import type { VehiclePhysicsConfig } from '../../types/vehicle';

// ── Room dimensions ────────────────────────────────────────────────────────
//
// The car needs enough runway to approach all three stations from a central
// spawn point.  60×50 gives comfortable driving distance without making the
// space feel like an empty warehouse.
//
// Coordinate convention (TryGame): +Z is forward (car spawn faces -Z).
// Back wall is at Z = -30, front wall at Z = +30, side walls at X = ±30.
//
const ROOM_W = 60; // X axis  (left / right)
const ROOM_D = 60; // Z axis  (front / back)
const ROOM_H = 12; // Y axis  (floor to ceiling)
const WALL_THICK = 0.4; // thin box walls

// ── Colour palette (matches the arcade screen purple/indigo theme) ─────────
const C_FLOOR = '#0e0e1a'; // near-black with blue tinge
const C_WALL = '#111126'; // dark indigo wall
const C_CEILING = '#0b0b18'; // slightly darker ceiling
const C_BASEBOARD = '#1c1c3a'; // subtle baseboard strip
const C_NEON_WALL = '#6366f1'; // indigo-500 — back-wall neon strip
const C_NEON_SIDE = '#a855f7'; // purple-500 — side-wall neon strips
const C_NEON_FLOOR = '#312e81'; // dark neon bleed on skirting

// ── Helper: thin neon emissive strip ──────────────────────────────────────
// Produces a flat box that glows.  Used for decorative LED strips.
interface NeonStripProps {
  readonly position: [number, number, number];
  readonly size: [number, number, number];
  readonly color: string;
  readonly intensity?: number;
}

const NeonStrip: React.FC<NeonStripProps> = ({ position, size, color, intensity = 1.2 }) => (
  <mesh position={position}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} />
  </mesh>
);

// ── Helper: wall panel with baseboard ────────────────────────────────────
interface WallPanelProps {
  readonly position: [number, number, number];
  readonly rotation?: [number, number, number];
  readonly width: number;
  readonly height: number;
}

const WallPanel: React.FC<WallPanelProps> = ({ position, rotation = [0, 0, 0], width, height }) => (
  <group position={position} rotation={rotation}>
    {/* Main wall surface */}
    <mesh receiveShadow>
      <boxGeometry args={[width, height, WALL_THICK]} />
      <meshStandardMaterial color={C_WALL} roughness={0.85} metalness={0.05} />
    </mesh>

    {/* Baseboard strip at the bottom of each wall */}
    <mesh position={[0, -height / 2 + 0.15, WALL_THICK / 2 + 0.01]}>
      <boxGeometry args={[width, 0.3, 0.06]} />
      <meshStandardMaterial
        color={C_BASEBOARD}
        emissive={C_NEON_FLOOR}
        emissiveIntensity={0.25}
        roughness={0.4}
      />
    </mesh>
  </group>
);

// ── Room geometry component ────────────────────────────────────────────────
//
// Placeholder prop clusters:
//   - Back wall   center:  Desk + monitor  → Backlog section
//     (actual GLTF TBD — placeholder is a glowing monitor geometry)
//   - Back wall   left:    Arcade cabinet  → Already handled by ArcadeCabinetMesh
//   - Back wall   right:   Trophy case     → Already handled by TrophyCaseMesh
//
// Future placeholders (dashed in the layout diagram):
//   - Left wall:   sofa + coffee table
//   - Right wall:  PC tower + LED shelf
//   - Ceiling:     hanging pendant lights
//
const Room: React.FC = () => {
  const hw = ROOM_W / 2; // half width  = 30
  const hd = ROOM_D / 2; // half depth  = 30

  return (
    <group>
      {/* ── Floor ────────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={C_FLOOR} roughness={0.9} metalness={0.0} />
      </mesh>

      {/* ── Ceiling ──────────────────────────────────────────────────── */}
      <mesh position={[0, ROOM_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={C_CEILING} roughness={1} />
      </mesh>

      {/* ── Back wall (Z = -hd) ──────────────────────────────────────── */}
      <WallPanel position={[0, ROOM_H / 2, -hd]} width={ROOM_W} height={ROOM_H} />

      {/* Back-wall neon strip — runs full width near ceiling */}
      <NeonStrip
        position={[0, ROOM_H - 0.4, -hd + WALL_THICK / 2 + 0.01]}
        size={[ROOM_W - 0.2, 0.12, 0.04]}
        color={C_NEON_WALL}
        intensity={1.4}
      />

      {/* ── Left wall (X = -hw) ──────────────────────────────────────── */}
      <WallPanel
        position={[-hw, ROOM_H / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={ROOM_D}
        height={ROOM_H}
      />

      {/* Left-wall neon strip */}
      <NeonStrip
        position={[-hw + WALL_THICK / 2 + 0.01, ROOM_H - 0.4, 0]}
        size={[0.04, 0.12, ROOM_D - 0.2]}
        color={C_NEON_SIDE}
        intensity={1.0}
      />

      {/* ── Right wall (X = +hw) ─────────────────────────────────────── */}
      <WallPanel
        position={[hw, ROOM_H / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        width={ROOM_D}
        height={ROOM_H}
      />

      {/* Right-wall neon strip */}
      <NeonStrip
        position={[hw - WALL_THICK / 2 - 0.01, ROOM_H - 0.4, 0]}
        size={[0.04, 0.12, ROOM_D - 0.2]}
        color={C_NEON_SIDE}
        intensity={1.0}
      />

      {/* ── Front wall (Z = +hd) — behind the player spawn ───────────── */}
      {/* Kept thin so the camera doesn't clip into it at spawn */}
      <WallPanel position={[0, ROOM_H / 2, hd]} width={ROOM_W} height={ROOM_H} />

      {/* ── Floor rug (center of room, purely visual) ─────────────────── */}
      {/*
       * A dark rectangle that breaks up the monotone floor.
       * Y offset: just above the plane (0.005) to avoid z-fighting.
       */}
      <mesh position={[0, 0.005, 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color="#16162a" roughness={0.95} />
      </mesh>

      {/* Rug border strip (thin emissive line around rug edge) */}
      {[
        // top edge
        { pos: [0, 0.006, 2 - 7] as [number, number, number], size: [18, 0.12] },
        // bottom edge
        { pos: [0, 0.006, 2 + 7] as [number, number, number], size: [18, 0.12] },
        // left edge
        { pos: [-9, 0.006, 2] as [number, number, number], size: [0.12, 14] },
        // right edge
        { pos: [9, 0.006, 2] as [number, number, number], size: [0.12, 14] },
      ].map(({ pos, size }, i) => (
        <mesh key={i} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size[0], size[1]]} />
          <meshStandardMaterial
            color={C_NEON_WALL}
            emissive={C_NEON_WALL}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* ── Decorative placeholder: LED shelf (right wall, above trophy case) ──
       *
       * A simple wall-mounted shelf plank with two glowing "collectible" cubes.
       * FUTURE: replace cubes with GLTF figurine/collectible models.
       */}
      <group position={[hw - 0.5, 5.5, -14]}>
        {/* Shelf plank */}
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.12, 5]} />
          <meshStandardMaterial color="#1e1e3a" roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Collectible cube 1 — amber glow */}
        <mesh position={[0, 0.25, -1.2]} castShadow>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Collectible cube 2 — indigo glow */}
        <mesh position={[0, 0.25, 1.2]} castShadow>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial
            color="#818cf8"
            emissive="#818cf8"
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Under-shelf LED strip */}
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[0.04, 0.04, 4.8]} />
          <meshStandardMaterial
            color={C_NEON_SIDE}
            emissive={C_NEON_SIDE}
            emissiveIntensity={1.5}
          />
        </mesh>
      </group>

      {/* ── Decorative placeholder: sofa (left side, facing center) ──────
       *
       * Simple L-shape sofa geometry in the left corner.
       * FUTURE: replace with a low-poly GLTF sofa model.
       */}
      <group position={[-22, 0, 8]}>
        {/* Seat cushion */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[6, 1, 3]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
        </mesh>
        {/* Backrest */}
        <mesh position={[0, 1.5, -1.3]} castShadow>
          <boxGeometry args={[6, 1.2, 0.5]} />
          <meshStandardMaterial color="#1c1c32" roughness={0.9} />
        </mesh>
        {/* Armrests */}
        <mesh position={[-2.75, 0.9, 0]} castShadow>
          <boxGeometry args={[0.5, 0.8, 3]} />
          <meshStandardMaterial color="#1c1c32" roughness={0.9} />
        </mesh>
        <mesh position={[2.75, 0.9, 0]} castShadow>
          <boxGeometry args={[0.5, 0.8, 3]} />
          <meshStandardMaterial color="#1c1c32" roughness={0.9} />
        </mesh>
      </group>

      {/* ── Decorative placeholder: PC tower (right side) ───────────────
       *
       * A tall tower with a glowing front panel.
       * FUTURE: replace with a GLTF PC tower model.
       */}
      <group position={[22, 0, 4]}>
        {/* Tower body */}
        <mesh position={[0, 1.8, 0]} castShadow>
          <boxGeometry args={[1.2, 3.6, 2]} />
          <meshStandardMaterial color="#101020" roughness={0.3} metalness={0.6} />
        </mesh>
        {/* Front panel LED strip (RGB placeholder — indigo) */}
        <mesh position={[-0.61, 1.8, 0]}>
          <boxGeometry args={[0.02, 2.4, 0.3]} />
          <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={1.8} />
        </mesh>
        {/* Fan glow circle approximated with a thin cylinder */}
        <mesh position={[-0.62, 2.8, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
          <meshStandardMaterial
            color="#4f46e5"
            emissive="#4f46e5"
            emissiveIntensity={1.0}
            transparent
            opacity={0.7}
          />
        </mesh>
      </group>

      {/* ── Ceiling pendant lights ────────────────────────────────────────
       *
       * Three simple pendant lamp shapes hanging from the ceiling.
       * These serve as visual anchors and justify the point lights below.
       */}
      {([-16, 0, 16] as number[]).map((x, i) => (
        <group key={i} position={[x, ROOM_H, 0]}>
          {/* Cord */}
          <mesh>
            <cylinderGeometry args={[0.03, 0.03, 1.5, 6]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          {/* Shade (inverted cone approximated as a narrow cylinder) */}
          <mesh position={[0, -1.1, 0]}>
            <cylinderGeometry args={[0.0, 0.55, 0.5, 8]} />
            <meshStandardMaterial color="#1e1e3a" metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ── Stage ─────────────────────────────────────────────────────────────────

interface StageProps {
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
}

export const Stage: React.FC<StageProps> = ({ physicsConfig = DEFAULT_PHYSICS_CONFIG }) => {
  const carRootRef = useRef<THREE.Group>(null);
  const carSpeedRef = useRef<number>(0);

  const cameraMode = useCameraMode();
  const { carControlsRef, arcadeControlsRef } = useInputRouter(cameraMode.modeRef);

  return (
    <>
      {/* ── Lighting ──────────────────────────────────────────────────── */}

      {/* Low ambient so the neon strips feel like they're doing work */}
      <ambientLight intensity={0.3} color="#1a1a3e" />

      {/* Main directional fill from above-front */}
      <directionalLight
        position={[0, ROOM_H - 1, 10]}
        intensity={0.8}
        color="#c8c0ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Three pendant point lights matching the pendant geometry above */}
      <pointLight position={[-16, ROOM_H - 1.8, 0]} intensity={18} distance={22} color="#9090ff" />
      <pointLight position={[0, ROOM_H - 1.8, 0]} intensity={18} distance={22} color="#9090ff" />
      <pointLight position={[16, ROOM_H - 1.8, 0]} intensity={18} distance={22} color="#9090ff" />

      {/* Subtle neon spill from the back wall strip */}
      <pointLight position={[0, ROOM_H - 0.5, -28]} intensity={8} distance={15} color="#6366f1" />

      {/* ── Systems ───────────────────────────────────────────────────── */}
      <CameraController
        targetRef={carRootRef}
        currentSpeedRef={carSpeedRef}
        modeControls={cameraMode}
      />

      <Car
        sharedRootRef={carRootRef}
        sharedSpeedRef={carSpeedRef}
        colliders={BILLBOARD_COLLIDERS}
        physicsConfig={physicsConfig}
        controlsRef={carControlsRef}
      />

      <Billboards3D
        carPositionRef={carRootRef}
        cameraControls={cameraMode}
        arcadeControlsRef={arcadeControlsRef}
      />

      {/* ── Room ──────────────────────────────────────────────────────── */}
      <Room />
    </>
  );
};
