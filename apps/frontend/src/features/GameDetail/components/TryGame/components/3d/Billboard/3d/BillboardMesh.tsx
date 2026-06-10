/**
 * Category-aware billboard dispatcher.
 *
 * OCP: adding a new category-specific structure means adding one more
 * branch here and a new component file — existing structures are untouched.
 *
 * Current routing:
 *   'playing'   → ArcadeCabinetMesh     (GLTF arcade cabinet model)
 *   'completed' → TrophyCaseMesh        (GLTF trophy case model)
 *   'backlog'   → DeskMonitorMesh       (geometric placeholder — GLTF TBD)
 */

import React, { useMemo } from 'react';

import { Html } from '@react-three/drei';
import { Zap } from 'lucide-react';

import { ArcadeCabinetMesh } from './ArcadeCabinate/ArcadeCabinetMesh';
import BillboardScreen from './BillboardScreen';
import { TrophyCaseMesh } from './TrophyCase/TrophyCaseMesh';
import { GAME_CATEGORY_CONFIG } from '../../../../types/billboard';
import { CollisionBoxHelper } from '../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../types/billboard';
import type { ArcadeControls } from '../../../../types/input';
import type { Game } from '@repo/shared';

interface BillboardProps extends BillboardConfig {
  readonly isSelected?: boolean;
  readonly isNearby?: boolean;
  readonly games?: readonly Game[];
  readonly isLoading?: boolean;
  readonly isOpen?: boolean;
  readonly showPrompt?: boolean;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  readonly arcadeControlsRef: React.RefObject<ArcadeControls>;
}

export const Billboard: React.FC<BillboardProps> = (props) => {
  const { category } = props;

  // ── "Playing" category → arcade cabinet ─────────────────────────────
  if (category === 'playing') return <ArcadeCabinetMesh {...props} />;

  // ── "Completed" category → trophy case ──────────────────────────────
  if (category === 'completed') return <TrophyCaseMesh {...props} />;

  // ── "Backlog" category → desk + monitor placeholder ──────────────────
  //    FUTURE: swap DeskMonitorMesh for a proper GLTF desk model
  if (category === 'backlog') return <DeskMonitorMesh {...props} />;

  // ── Fallback: flat panel (safety net for any future categories) ───────
  return <FlatBillboard {...props} />;
};

// ── DeskMonitorMesh ──────────────────────────────────────────────────────
//
// Geometric placeholder for the "backlog" station.
//
// Visual language matches the room: dark surfaces, purple/indigo glow,
// amber highlight for selected state.
//
// Layout (all measurements in Three.js world units):
//
//   Desk surface:  2.4w × 0.1h × 1.0d  at y = 1.0
//   Monitor:       1.6w × 0.9h × 0.06d at y = 1.97
//   Monitor stand: 0.08w × 0.35h        at y = 1.52
//   Stand base:    0.5w × 0.04h         at y = 1.34
//   Keyboard:      1.0w × 0.04h × 0.35d at y = 1.07
//   Screen (Html): 1.5w × 0.82h         centred on monitor face
//
// The collision OBB is fed from BillboardConfig (width/height), same as
// the flat panel — the desk body itself is purely visual.
//
// "FUTURE GLTF" comments mark the exact meshes to replace once you find
// the right asset.  Replace the geometry group wholesale; keep the Html
// screen and collision helper as-is.

// ── Tunable values ───────────────────────────────────────────────────────
const DESK_W = 2.4;
const DESK_D = 1.0;
const DESK_H = 0.1;
const DESK_Y = 1.0; // top surface y

const LEG_W = 0.08;
const LEG_H = DESK_Y; // legs go from 0 to DESK_Y

const MON_W = 1.6;
const MON_H = 0.9;
const MON_D = 0.06;
const MON_Y = DESK_Y + MON_H / 2 + 0.06 + 0.35; // ≈ 1.97

const SCREEN_W = MON_W * 0.92;
const SCREEN_H = MON_H * 0.9;
const HTML_W = SCREEN_W * 100;
const HTML_H = SCREEN_H * 100;

const C_DESK_BODY = '#101018'; // almost-black desk surface
const C_DESK_EDGE = '#1e1e3a'; // slightly lighter edge trim
const C_BEZEL = '#0d0d20'; // monitor bezel
const C_SCREEN_BG = '#0d1117'; // screen backing
const C_GLOW_IDLE = '#818cf8'; // indigo — default screen bezel glow
const C_GLOW_NEAR = '#60a5fa'; // blue — proximity
const C_GLOW_SEL = '#fbbf24'; // amber — selected
const C_KEYBOARD = '#13132a';

const DeskMonitorMesh: React.FC<BillboardProps> = ({
  position,
  rotation,
  category,
  isSelected = false,
  isNearby = false,
  games = [],
  isLoading = false,
  isOpen = false,
  showPrompt = false,
  onOpen,
  onClose,
}) => {
  const config = GAME_CATEGORY_CONFIG[category];
  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  // Bezel / glow colour reacts to selection state
  const bezelColor = useMemo(() => {
    if (isSelected) return C_GLOW_SEL;
    if (isNearby) return C_GLOW_NEAR;
    return C_GLOW_IDLE;
  }, [isSelected, isNearby]);

  const bezelEmissive = useMemo(() => {
    if (isSelected) return 0.6;
    if (isNearby) return 0.35;
    return 0.15;
  }, [isSelected, isNearby]);

  return (
    <group position={position as [number, number, number]} rotation={rotationArray}>
      {/* ── FUTURE GLTF: replace everything in this group with <DeskGLTF /> ── */}

      {/* Desk surface */}
      <mesh position={[0, DESK_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[DESK_W, DESK_H, DESK_D]} />
        <meshStandardMaterial color={C_DESK_BODY} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Desk edge trim — thin front-face strip */}
      <mesh position={[0, DESK_Y, DESK_D / 2 - 0.01]} castShadow>
        <boxGeometry args={[DESK_W, DESK_H + 0.02, 0.03]} />
        <meshStandardMaterial color={C_DESK_EDGE} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Desk legs (4 corners) */}
      {(
        [
          [-DESK_W / 2 + 0.12, -DESK_D / 2 + 0.12],
          [DESK_W / 2 - 0.12, -DESK_D / 2 + 0.12],
          [-DESK_W / 2 + 0.12, DESK_D / 2 - 0.12],
          [DESK_W / 2 - 0.12, DESK_D / 2 - 0.12],
        ] as [number, number][]
      ).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, DESK_Y / 2, lz]} castShadow>
          <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
          <meshStandardMaterial color={C_DESK_BODY} roughness={0.3} metalness={0.6} />
        </mesh>
      ))}

      {/* ── FUTURE GLTF: replace this group with <MonitorGLTF /> ── */}

      {/* Monitor stand post */}
      <mesh position={[0, DESK_Y + 0.35 / 2 + DESK_H / 2, -0.05]} castShadow>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color={C_DESK_BODY} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Monitor stand base */}
      <mesh position={[0, DESK_Y + DESK_H / 2 + 0.02, 0.05]} castShadow>
        <boxGeometry args={[0.5, 0.04, 0.3]} />
        <meshStandardMaterial color={C_DESK_BODY} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Monitor bezel shell */}
      <mesh position={[0, MON_Y, 0]} castShadow>
        <boxGeometry args={[MON_W + 0.08, MON_H + 0.08, MON_D]} />
        <meshStandardMaterial
          color={C_BEZEL}
          emissive={bezelColor}
          emissiveIntensity={bezelEmissive}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      {/* Screen backing */}
      <mesh position={[0, MON_Y, MON_D / 2 + 0.01]}>
        <boxGeometry args={[SCREEN_W, SCREEN_H, 0.01]} />
        <meshStandardMaterial color={C_SCREEN_BG} roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Keyboard */}
      <mesh position={[0, DESK_Y + DESK_H / 2 + 0.02, DESK_D / 2 - 0.2]} castShadow>
        <boxGeometry args={[1.0, 0.04, 0.35]} />
        <meshStandardMaterial color={C_KEYBOARD} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Keyboard indicator light (tiny emissive dot) */}
      <mesh position={[0.44, DESK_Y + DESK_H / 2 + 0.03, DESK_D / 2 - 0.06]}>
        <boxGeometry args={[0.04, 0.02, 0.04]} />
        <meshStandardMaterial color={C_GLOW_IDLE} emissive={C_GLOW_IDLE} emissiveIntensity={1.2} />
      </mesh>

      {/* Under-desk LED strip */}
      <mesh position={[0, DESK_Y - DESK_H / 2 - 0.01, 0]}>
        <boxGeometry args={[DESK_W - 0.1, 0.03, 0.03]} />
        <meshStandardMaterial color={bezelColor} emissive={bezelColor} emissiveIntensity={0.8} />
      </mesh>

      {/* ── Screen Html portal ───────────────────────────────────────── */}
      <Html
        position={[0, MON_Y, MON_D / 2 + 0.03]}
        transform
        occlude
        style={{
          width: HTML_W,
          height: HTML_H,
          overflow: 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <BillboardScreen
          config={config}
          games={games}
          isLoading={isLoading}
          isOpen={isOpen}
          selectedGame={games[0]}
          selectedIndex={0}
          isSelected={isSelected}
          screenW={HTML_W}
          screenH={HTML_H}
          onOpen={onOpen}
          onClose={onClose}
        />
      </Html>

      {/* ── Interaction prompt ───────────────────────────────────────── */}
      {showPrompt && games.length > 0 && (
        <group position={[0, DESK_Y - 0.6, DESK_D / 2 + 0.2]}>
          <mesh castShadow>
            <boxGeometry args={[3.2, 0.5, 0.04]} />
            <meshStandardMaterial
              color="#0f172a"
              metalness={0.6}
              roughness={0.2}
              transparent
              opacity={0.9}
            />
          </mesh>
          <Html
            position={[0, 0, 0.03]}
            transform
            occlude
            style={{
              width: '300px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border-2 border-current backdrop-blur-md shadow-lg"
              style={{ backgroundColor: `${config.color}15`, color: config.color }}
            >
              <Zap size={14} className="animate-pulse flex-shrink-0" />
              <span className="font-bold text-xs tracking-wider uppercase whitespace-nowrap">
                Press E or Enter
              </span>
            </div>
            <div className="text-center mt-1 text-[10px] font-medium text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
              {config.label} • {games.length} {games.length === 1 ? 'game' : 'games'}
            </div>
          </Html>
        </group>
      )}

      {/* Proximity glow plane (subtle, behind the desk) */}
      {isNearby && (
        <mesh position={[0, MON_Y, -0.05]}>
          <boxGeometry args={[MON_W + 0.5, MON_H + 0.5, 0.04]} />
          <meshStandardMaterial
            color={bezelColor}
            transparent
            opacity={0.08}
            emissive={bezelColor}
            emissiveIntensity={0.15}
          />
        </mesh>
      )}

      <CollisionBoxHelper
        position={[0, MON_Y, 0]}
        size={[MON_W + 0.08, MON_H + 0.08, MON_D + DESK_D]}
        color="#60a5fa"
      />
    </group>
  );
};

// ── FlatBillboard (safety fallback) ───────────────────────────────────────
//
// Retained as a fallback for any future category not yet assigned a mesh.
// Should never be visible in normal play.

const FlatBillboard: React.FC<BillboardProps> = ({
  position,
  width,
  height,
  rotation,
  category,
  isSelected = false,
  isNearby = false,
  games = [],
  isLoading = false,
  isOpen = false,
  showPrompt = false,
  onOpen,
  onClose,
}) => {
  const config = GAME_CATEGORY_CONFIG[category];

  const frameColor = useMemo(() => {
    if (isSelected) return '#fbbf24';
    if (isNearby) return '#60a5fa';
    return '#64748b';
  }, [isSelected, isNearby]);

  const emissiveIntensity = useMemo(() => {
    if (isSelected) return 0.4;
    if (isNearby) return 0.2;
    return 0;
  }, [isSelected, isNearby]);

  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  const frameThickness = 0.15;
  const frameDepth = 0.1;
  const displayScale = 0.95;
  const htmlW = width * displayScale * 100;
  const htmlH = height * displayScale * 100;

  return (
    <group position={position as [number, number, number]} rotation={rotationArray}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width + frameThickness * 2, height + frameThickness * 2, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          emissive={frameColor}
          emissiveIntensity={emissiveIntensity}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, 0, frameDepth / 2 + 0.01]} receiveShadow>
        <boxGeometry args={[width * displayScale, height * displayScale, 0.02]} />
        <meshStandardMaterial color="#0d1117" metalness={0.1} roughness={0.8} />
      </mesh>

      <Html
        position={[0, 0, frameDepth / 2 + 0.03]}
        transform
        occlude
        style={{
          width: htmlW,
          height: htmlH,
          overflow: 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <BillboardScreen
          config={config}
          games={games}
          isLoading={isLoading}
          isOpen={isOpen}
          selectedGame={games[0]}
          selectedIndex={0}
          isSelected={isSelected}
          screenW={htmlW}
          screenH={htmlH}
          onOpen={onOpen}
          onClose={onClose}
        />
      </Html>

      <group position={[0, height / 2 + frameThickness * 1.2, frameDepth / 2 + 0.05]}>
        <mesh>
          <planeGeometry args={[width * displayScale, frameThickness]} />
          <meshStandardMaterial
            color={config.color}
            emissive={config.color}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>

      {showPrompt && games.length > 0 && (
        <group position={[0, -height / 2 - 1.0, frameDepth / 2 + 0.2]}>
          <mesh castShadow>
            <boxGeometry args={[3.2, 0.5, 0.04]} />
            <meshStandardMaterial
              color="#0f172a"
              metalness={0.6}
              roughness={0.2}
              transparent
              opacity={0.9}
            />
          </mesh>
          <Html
            position={[0, 0, 0.03]}
            transform
            occlude
            style={{
              width: '300px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border-2 border-current backdrop-blur-md shadow-lg"
              style={{ backgroundColor: `${config.color}15`, color: config.color }}
            >
              <Zap size={14} className="animate-pulse flex-shrink-0" />
              <span className="font-bold text-xs tracking-wider uppercase whitespace-nowrap">
                Press E or Enter
              </span>
            </div>
            <div className="text-center mt-1 text-[10px] font-medium text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
              {config.label} • {games.length} {games.length === 1 ? 'game' : 'games'}
            </div>
          </Html>
        </group>
      )}

      {isNearby && (
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry
            args={[width + frameThickness * 2 + 0.3, height + frameThickness * 2 + 0.3, 0.05]}
          />
          <meshStandardMaterial
            color="#60a5fa"
            transparent
            opacity={0.15}
            emissive="#60a5fa"
            emissiveIntensity={0.2}
          />
        </mesh>
      )}

      <CollisionBoxHelper
        position={[0, 0, 0]}
        size={[width + frameThickness * 2, height + frameThickness * 2, frameDepth]}
        color="#38bdf8"
      />
    </group>
  );
};
