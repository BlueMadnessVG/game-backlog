// components/3d/Billboard/3d/BillboardMesh.tsx
/**
 * Category-aware billboard dispatcher.
 *
 * OCP: adding a new category-specific structure means adding one more
 * branch here and a new component file — existing structures are untouched.
 *
 * Current routing:
 *   'playing'   → ArcadeCabinetMesh  (GLTF arcade cabinet model)
 *   'completed' → flat Billboard panel  (unchanged, future: trophy case)
 *   'backlog'   → flat Billboard panel  (unchanged, future: crate stack)
 */

import React, { useMemo } from 'react';

import { Html } from '@react-three/drei';
import { Zap } from 'lucide-react';

import { ArcadeCabinetMesh } from './ArcadeCabinate/ArcadeCabinetMesh';
import BillboardScreen from './BillboardScreen';
import { GAME_CATEGORY_CONFIG } from '../../../../types/billboard';
import { CollisionBoxHelper } from '../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../types/billboard';
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
}

export const Billboard: React.FC<BillboardProps> = (props) => {
  const { category } = props;

  // ── "Playing" category → arcade cabinet ─────────────────────────────
  if (category === 'playing') {
    return <ArcadeCabinetMesh {...props} />;
  }

  // ── All other categories → flat panel (existing implementation) ──────
  return <FlatBillboard {...props} />;
};

// ── Flat panel implementation (unchanged from original) ───────────────────

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
      {/* Frame */}
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

      {/* Display backing */}
      <mesh position={[0, 0, frameDepth / 2 + 0.01]} receiveShadow>
        <boxGeometry args={[width * displayScale, height * displayScale, 0.02]} />
        <meshStandardMaterial color="#0d1117" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Screen */}
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

      {/* Category header strip */}
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

      {/* Interaction prompt */}
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

      {/* Proximity glow */}
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
