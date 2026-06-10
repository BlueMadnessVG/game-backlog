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

// ── Room dimensions ──────────────────────────────────────────────────────────
const ROOM_W = 60; // X  left / right
const ROOM_D = 60; // Z  front / back
const ROOM_H = 12; // Y  floor / ceiling
const WALL_THICK = 0.35;

// ── Palette ───────────────────────────────────────────────────────────────────
//
// Base surfaces: bright, cozy — think well-lit apartment, not dark cave.
// Purple accents come only from the CSS token set so everything stays coherent.
//
//  CSS tokens carried into 3D:
//    Primary   #6366f1  (indigo-500)
//    Secondary #a855f7  (purple-500)
//    Accent    #c084fc  (purple-400)
//    Gold      #fbbf24  (amber-400)
//
const C_WALL = '#f2ede8'; // warm off-white — well-lit cream
const C_WALL_ALT = '#ede6e0'; // very slightly warmer for side walls
const C_CEILING = '#faf7f4'; // near white, airy
const C_BASEBOARD = '#e8e0d8'; // slightly toned baseboard
const C_CROWN = '#d4c4b8'; // crown moulding strip
const C_FLOOR_A = '#c9a87c'; // honey-oak plank (lighter)
const C_FLOOR_B = '#b8946a'; // honey-oak plank (darker)
const C_FLOOR_GAP = '#8a6a48'; // plank gap line

const C_RUG = '#5b4d8a'; // muted purple rug — pulls in the screen palette
const C_RUG_BORDER = '#fbbf24'; // amber border — matches gold token

const C_SOFA = '#e8d4bc'; // linen / oat
const C_SOFA_TRIM = '#c8a88a'; // slightly darker piping
const C_SOFA_LEG = '#a07858'; // warm walnut wood leg

const C_TABLE_TOP = '#d4b896'; // natural pine
const C_TABLE_LEG = '#a07858';

const C_SHELF_PLANK = '#d4b896'; // pine shelf
const C_SHELF_BRKT = '#a07858'; // bracket

const C_PC_BODY = '#e8e4de'; // matte off-white PC tower
const C_PC_VENT = '#c8c4be'; // darker vent panel
const C_PC_GLOW = '#6366f1'; // indigo LED (CSS token)

const C_FRAME_WOOD = '#a07858'; // picture frame walnut
const C_CANVAS_A = '#b8cca8'; // sage-wash canvas
const C_CANVAS_B = '#c4b0a0'; // warm rose-beige canvas

const C_PENDANT_CORD = '#8a7060'; // cord
const C_PENDANT_SHADE = '#a07858'; // wood shade

const C_PILLOW_A = '#c4856a'; // terracotta pillow
const C_PILLOW_B = '#8faa7e'; // sage pillow

const C_POT = '#c4856a'; // terracotta plant pot
const C_PLANT = '#8faa7e'; // plant foliage

// Purple-accent rope light — this is the one neon element; kept subtle
const C_ROPE_INDIGO = '#6366f1'; // CSS primary
const C_ROPE_PURPLE = '#a855f7'; // CSS secondary
const C_BULB = '#fff8e8'; // warm bulb glow

// ── Helpers ────────────────────────────────────────────────────────────────

interface StripProps {
  readonly position: [number, number, number];
  readonly size: [number, number, number];
  readonly color: string;
  readonly intensity?: number;
}

const EmissiveStrip: React.FC<StripProps> = ({ position, size, color, intensity = 0.5 }) => (
  <mesh position={position}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} />
  </mesh>
);

// ── Plank floor ─────────────────────────────────────────────────────────────
const PlankFloor: React.FC = () => {
  const PLANK_W = 2.5;
  const count = Math.ceil(ROOM_W / PLANK_W);
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const x = -ROOM_W / 2 + i * PLANK_W + PLANK_W / 2;
        return (
          <mesh key={i} position={[x, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[PLANK_W - 0.04, ROOM_D]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? C_FLOOR_A : C_FLOOR_B}
              roughness={0.8}
              metalness={0.0}
            />
          </mesh>
        );
      })}
      {/* Thin gap lines */}
      {Array.from({ length: count - 1 }).map((_, i) => {
        const x = -ROOM_W / 2 + (i + 1) * PLANK_W;
        return (
          <mesh key={`g${i}`} position={[x, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, ROOM_D]} />
            <meshStandardMaterial color={C_FLOOR_GAP} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Wall panel — bright wall with baseboard + crown moulding ────────────────
interface WallProps {
  readonly position: [number, number, number];
  readonly rotation?: [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly color?: string;
}
const WallPanel: React.FC<WallProps> = ({
  position,
  rotation = [0, 0, 0],
  width,
  height,
  color = C_WALL,
}) => (
  <group position={position} rotation={rotation}>
    {/* Wall surface */}
    <mesh receiveShadow>
      <boxGeometry args={[width, height, WALL_THICK]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
    </mesh>
    {/* Baseboard */}
    <mesh position={[0, -height / 2 + 0.18, WALL_THICK / 2 + 0.01]}>
      <boxGeometry args={[width, 0.36, 0.06]} />
      <meshStandardMaterial color={C_BASEBOARD} roughness={0.5} />
    </mesh>
    {/* Crown moulding */}
    <mesh position={[0, height / 2 - 0.12, WALL_THICK / 2 + 0.01]}>
      <boxGeometry args={[width, 0.2, 0.08]} />
      <meshStandardMaterial color={C_CROWN} roughness={0.55} />
    </mesh>
  </group>
);

// ── Room ────────────────────────────────────────────────────────────────────
const Room: React.FC = () => {
  const hw = ROOM_W / 2;
  const hd = ROOM_D / 2;

  return (
    <group>
      {/* Floor */}
      <PlankFloor />

      {/* Ceiling */}
      <mesh position={[0, ROOM_H, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={C_CEILING} roughness={0.95} />
      </mesh>

      {/* Back wall */}
      <WallPanel position={[0, ROOM_H / 2, -hd]} width={ROOM_W} height={ROOM_H} />
      {/* Indigo rope-light along back wall ceiling edge — screen spill feel */}
      <EmissiveStrip
        position={[0, ROOM_H - 0.38, -hd + WALL_THICK / 2 + 0.02]}
        size={[ROOM_W - 0.3, 0.07, 0.07]}
        color={C_ROPE_INDIGO}
        intensity={0.8}
      />
      {/* Matching point light spill from back wall rope */}
      {/* (handled in Stage lighting below) */}

      {/* Left wall */}
      <WallPanel
        position={[-hw, ROOM_H / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={ROOM_D}
        height={ROOM_H}
        color={C_WALL_ALT}
      />
      <EmissiveStrip
        position={[-hw + WALL_THICK / 2 + 0.02, ROOM_H - 0.38, 0]}
        size={[0.07, 0.07, ROOM_D - 0.3]}
        color={C_ROPE_PURPLE}
        intensity={0.5}
      />

      {/* Right wall */}
      <WallPanel
        position={[hw, ROOM_H / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        width={ROOM_D}
        height={ROOM_H}
        color={C_WALL_ALT}
      />
      <EmissiveStrip
        position={[hw - WALL_THICK / 2 - 0.02, ROOM_H - 0.38, 0]}
        size={[0.07, 0.07, ROOM_D - 0.3]}
        color={C_ROPE_PURPLE}
        intensity={0.5}
      />

      {/* Front wall (behind player spawn) */}
      <WallPanel position={[0, ROOM_H / 2, hd]} width={ROOM_W} height={ROOM_H} />

      {/* ── Rug: purple centre, amber border ── */}
      <mesh position={[0, 0.004, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color={C_RUG} roughness={0.95} />
      </mesh>
      {[
        { p: [0, 0.005, 4 - 6.8] as [number, number, number], s: [18, 0.28] as [number, number] },
        { p: [0, 0.005, 4 + 6.8] as [number, number, number], s: [18, 0.28] as [number, number] },
        { p: [-8.86, 0.005, 4] as [number, number, number], s: [0.28, 14] as [number, number] },
        { p: [8.86, 0.005, 4] as [number, number, number], s: [0.28, 14] as [number, number] },
      ].map(({ p, s }, i) => (
        <mesh key={i} position={p} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[s[0], s[1]]} />
          <meshStandardMaterial color={C_RUG_BORDER} roughness={0.9} />
        </mesh>
      ))}

      {/* ── Sofa — linen, left side, facing center ── */}
      <group position={[-22, 0, 8]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[7, 1, 3.2]} />
          <meshStandardMaterial color={C_SOFA} roughness={0.92} />
        </mesh>
        <mesh position={[0, 1.55, -1.4]} castShadow>
          <boxGeometry args={[7, 1.3, 0.55]} />
          <meshStandardMaterial color={C_SOFA} roughness={0.92} />
        </mesh>
        {([-3.25, 3.25] as number[]).map((x, i) => (
          <mesh key={i} position={[x, 0.85, 0]} castShadow>
            <boxGeometry args={[0.55, 0.7, 3.2]} />
            <meshStandardMaterial color={C_SOFA_TRIM} roughness={0.88} />
          </mesh>
        ))}
        {(
          [
            [-3.0, -2.8],
            [3.0, -2.8],
            [-3.0, 2.8],
            [3.0, 2.8],
          ] as [number, number][]
        ).map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.12, lz]} castShadow>
            <boxGeometry args={[0.18, 0.25, 0.18]} />
            <meshStandardMaterial color={C_SOFA_LEG} roughness={0.45} metalness={0.05} />
          </mesh>
        ))}
        {/* Throw pillows */}
        <mesh position={[2.2, 1.05, -1.0]} castShadow>
          <boxGeometry args={[0.9, 0.9, 0.22]} />
          <meshStandardMaterial color={C_PILLOW_A} roughness={0.9} />
        </mesh>
        <mesh position={[-2.0, 1.05, -1.0]} castShadow>
          <boxGeometry args={[0.9, 0.9, 0.22]} />
          <meshStandardMaterial color={C_PILLOW_B} roughness={0.9} />
        </mesh>
        {/* Purple accent pillow — carries the palette into soft furnishings */}
        <mesh position={[0.4, 1.05, -1.0]} castShadow>
          <boxGeometry args={[0.9, 0.9, 0.22]} />
          <meshStandardMaterial color="#8b7ec8" roughness={0.9} />
        </mesh>
      </group>

      {/* ── Coffee table ── */}
      <group position={[-22, 0, 13]}>
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 0.08, 2]} />
          <meshStandardMaterial color={C_TABLE_TOP} roughness={0.48} metalness={0.05} />
        </mesh>
        {(
          [
            [-1.7, -0.8],
            [1.7, -0.8],
            [-1.7, 0.8],
            [1.7, 0.8],
          ] as [number, number][]
        ).map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.18, lz]} castShadow>
            <boxGeometry args={[0.1, 0.36, 0.1]} />
            <meshStandardMaterial color={C_TABLE_LEG} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ── Wall shelf (right wall, above trophy case) ── */}
      <group position={[hw - 0.5, 6, -14]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.1, 5.2]} />
          <meshStandardMaterial color={C_SHELF_PLANK} roughness={0.5} />
        </mesh>
        {([-1.9, 1.9] as number[]).map((z, i) => (
          <mesh key={i} position={[0.06, -0.22, z]} castShadow>
            <boxGeometry args={[0.18, 0.44, 0.08]} />
            <meshStandardMaterial color={C_SHELF_BRKT} roughness={0.5} />
          </mesh>
        ))}
        {/* Terracotta plant pot + sage foliage */}
        <mesh position={[0, 0.22, -1.5]} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.36, 8]} />
          <meshStandardMaterial color={C_POT} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.44, -1.5]} castShadow>
          <sphereGeometry args={[0.22, 8, 6]} />
          <meshStandardMaterial color={C_PLANT} roughness={0.9} />
        </mesh>
        {/* Stacked books — colour from arcade screen palette */}
        {([0, 0.08, 0.16] as number[]).map((yOff, i) => (
          <mesh key={i} position={[0, 0.1 + yOff, 1.5]} castShadow>
            <boxGeometry args={[0.22, 0.08, 0.7]} />
            <meshStandardMaterial
              color={(['#8faa7e', '#c4856a', '#8b7ec8'] as string[])[i]}
              roughness={0.8}
            />
          </mesh>
        ))}
        {/* Under-shelf purple rope light — CSS indigo token, very subtle */}
        <EmissiveStrip
          position={[0, -0.09, 0]}
          size={[0.04, 0.04, 5.0]}
          color={C_ROPE_INDIGO}
          intensity={0.4}
        />
      </group>

      {/* ── PC tower (right wall) — off-white with indigo LED ── */}
      <group position={[22, 0, 4]}>
        <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 3.8, 2.1]} />
          <meshStandardMaterial color={C_PC_BODY} roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[-0.56, 2.2, 0]}>
          <boxGeometry args={[0.02, 2.4, 1.4]} />
          <meshStandardMaterial color={C_PC_VENT} roughness={0.8} />
        </mesh>
        {/* Indigo LED strip — CSS primary token */}
        <mesh position={[-0.57, 1.9, 0]}>
          <boxGeometry args={[0.02, 2.4, 0.18]} />
          <meshStandardMaterial color={C_PC_GLOW} emissive={C_PC_GLOW} emissiveIntensity={1.2} />
        </mesh>
        {/* Power button */}
        <mesh position={[-0.57, 3.42, 0.6]}>
          <cylinderGeometry args={[0.08, 0.08, 0.02, 12]} />
          <meshStandardMaterial color="#8faa7e" emissive="#8faa7e" emissiveIntensity={0.5} />
        </mesh>
        {/* Feet */}
        {(
          [
            [-0.4, -0.9],
            [0.4, -0.9],
            [-0.4, 0.9],
            [0.4, 0.9],
          ] as [number, number][]
        ).map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.05, lz]} castShadow>
            <boxGeometry args={[0.14, 0.1, 0.14]} />
            <meshStandardMaterial color="#b0a898" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* ── Ceiling pendants — warm incandescent bulbs ── */}
      {([-16, 0, 16] as number[]).map((x, i) => (
        <group key={i} position={[x, ROOM_H, 0]}>
          <mesh>
            <cylinderGeometry args={[0.025, 0.025, 1.4, 6]} />
            <meshStandardMaterial color={C_PENDANT_CORD} roughness={0.8} />
          </mesh>
          <mesh position={[0, -1.05, 0]}>
            <cylinderGeometry args={[0.0, 0.62, 0.48, 12]} />
            <meshStandardMaterial color={C_PENDANT_SHADE} roughness={0.5} metalness={0.05} />
          </mesh>
          {/* Warm glow disc inside shade */}
          <mesh position={[0, -0.84, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
            <meshStandardMaterial color={C_BULB} emissive={C_BULB} emissiveIntensity={2.0} />
          </mesh>
        </group>
      ))}

      {/* ── Wall art (back wall, between stations) ── */}
      {(
        [
          [-10, 7],
          [10, 7],
        ] as [number, number][]
      ).map(([x, y], i) => (
        <group key={i} position={[x, y, -hd + WALL_THICK / 2 + 0.06]}>
          <mesh castShadow>
            <boxGeometry args={[3.4, 2.4, 0.1]} />
            <meshStandardMaterial color={C_FRAME_WOOD} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.07]}>
            <boxGeometry args={[3.0, 2.0, 0.02]} />
            <meshStandardMaterial color={i === 0 ? C_CANVAS_A : C_CANVAS_B} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ── Stage ────────────────────────────────────────────────────────────────────
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
      {/* ── Lighting ────────────────────────────────────────────────────
       *
       * Goal: bright, even room light that reads as "daytime indoors"
       * with a gentle purple tint coming from the screen stations.
       *
       * Three-point setup:
       *   A. Strong ambient — lifts every shadow to a readable mid-tone
       *   B. Warm directional — main fill, fakes ceiling bounce
       *   C. Cool back fill — keeps shadows from going muddy-dark
       *   D. Three pendant point lights — warm incandescent character
       *   E. Three screen spill lights — indigo/purple only at stations
       */}

      {/* A. Ambient — bright warm white, room feels lit not dim */}
      <ambientLight intensity={1.8} color="#fff8f2" />

      {/* B. Primary directional — wide soft fill from above-front */}
      <directionalLight
        position={[5, ROOM_H - 1, 15]}
        intensity={2.0}
        color="#fffcf5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />

      {/* C. Secondary back-left fill — reduces harsh contrast */}
      <directionalLight position={[-10, ROOM_H - 2, -8]} intensity={0.9} color="#f0ecff" />

      {/* D. Pendant point lights — incandescent warmth */}
      <pointLight position={[-16, ROOM_H - 1.7, 0]} intensity={28} distance={30} color="#fff3d0" />
      <pointLight position={[0, ROOM_H - 1.7, 0]} intensity={28} distance={30} color="#fff3d0" />
      <pointLight position={[16, ROOM_H - 1.7, 0]} intensity={28} distance={30} color="#fff3d0" />

      {/* E. Screen station spill — purple/indigo from the CSS token set.
       *   Low intensity: reads as monitor glow, not a spotlight. */}
      <pointLight position={[-20, 3.5, -22]} intensity={6} distance={12} color="#6366f1" />
      <pointLight position={[0, 2.5, -22]} intensity={6} distance={12} color="#a855f7" />
      <pointLight position={[20, 3.5, -22]} intensity={6} distance={12} color="#6366f1" />

      {/* Rope-light ceiling bounce from back wall */}
      <pointLight position={[0, ROOM_H - 0.5, -28]} intensity={4} distance={12} color="#6366f1" />

      {/* ── Systems ────────────────────────────────────────────────── */}
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

      {/* ── Room ───────────────────────────────────────────────────── */}
      <Room />
    </>
  );
};
