import React, { useMemo, useCallback, useEffect, useState } from 'react';

import { Html } from '@react-three/drei';

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
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

export const Billboard: React.FC<BillboardProps> = ({
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
  onOpen,
  onClose,
}) => {
  const config = GAME_CATEGORY_CONFIG[category];
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  const groupRotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  const frameThickness = 0.15;
  const frameDepth = 0.1;
  const displayScale = 0.95;

  // px dimensions for the Html portal (drei maps 1 unit → 100px by default)
  const htmlW = width * displayScale * 100;
  const htmlH = height * displayScale * 100;

  const selectedGame = games[selectedIndex];

  const prev = useCallback(
    () => setSelectedIndex((i) => (i === 0 ? games.length - 1 : i - 1)),
    [games.length],
  );
  const next = useCallback(
    () => setSelectedIndex((i) => (i === games.length - 1 ? 0 : i + 1)),
    [games.length],
  );

  // Reset index when category/games change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSelectedIndex(0), [category, games.length]);

  // Keyboard navigation when open
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, prev, next, onClose]);

  return (
    <group position={position} rotation={groupRotationArray}>
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

      {/* Display Surface (dark backing) */}
      <mesh position={[0, 0, frameDepth / 2 + 0.01]} receiveShadow>
        <boxGeometry args={[width * displayScale, height * displayScale, 0.02]} />
        <meshStandardMaterial color="#0d1117" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* ── HTML UI rendered ON the display surface ── */}
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
          selectedGame={selectedGame}
          selectedIndex={selectedIndex}
          onPrev={prev}
          onNext={next}
          onOpen={onOpen}
          onClose={onClose}
          isSelected={isSelected}
          screenW={htmlW}
          screenH={htmlH}
        />
      </Html>

      {/* Category label strip */}
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

      {/* Glow when nearby */}
      {isNearby && (
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry
            args={[width + frameThickness * 2 + 0.3, height + frameThickness * 2 + 0.3, 0.05]}
          />
          <meshStandardMaterial
            color="#60a5fa"
            transparent
            opacity={0.2}
            emissive="#60a5fa"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {/* Caja de asistencia visual de colisión (Debug) */}
      <CollisionBoxHelper
        position={[0, 0, 0]} // Relativo al grupo del Billboard
        size={[width + frameThickness * 2, height + frameThickness * 2, frameDepth]}
        color="#38bdf8" // Azul cielo para los anuncios
      />
    </group>
  );
};
