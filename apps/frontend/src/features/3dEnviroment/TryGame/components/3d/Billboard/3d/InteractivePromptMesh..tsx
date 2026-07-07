// components/3d/Billboard/3d/InteractionPromptMesh.tsx
import React, { useMemo } from 'react';

import { Html } from '@react-three/drei';
import { Zap } from 'lucide-react';

import { GAME_CATEGORY_CONFIG } from '../../../../types/billboard';

import type { GameCategory } from '../../../../types/billboard';

interface InteractionPromptMeshProps {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly category: GameCategory;
  readonly gameCount: number;
  readonly isVisible: boolean;
  readonly billboardWidth: number;
}

export const InteractionPromptMesh: React.FC<InteractionPromptMeshProps> = ({
  position,
  rotation,
  category,
  gameCount,
  isVisible,
}) => {
  const config = GAME_CATEGORY_CONFIG[category];

  // Calculate an offset so the prompt floats just in front of and slightly below the billboard mesh
  const promptPosition = useMemo(() => {
    // 0.35m forward on Z-axis to prevent clipping; 1.5m below the center of the billboard
    return [position[0], position[1] - 1.5, position[2] + 0.35] as [number, number, number];
  }, [position]);

  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  if (!isVisible || gameCount === 0) return null;

  return (
    <group position={promptPosition} rotation={rotationArray}>
      {/* Small floating technical bracket anchor behind the text */}
      <mesh castShadow>
        <boxGeometry args={[3, 0.4, 0.05]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.7}
          roughness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* 3D Transform HTML Interface matching the design styles of the project */}
      <Html
        position={[0, 0, 0.04]}
        transform
        occlude
        pointerEvents="none"
        style={{
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-full border border-current backdrop-blur-md shadow-lg"
          style={{
            backgroundColor: `${config.color}15`,
            color: config.color,
          }}
        >
          <Zap size={16} className="animate-pulse flex-shrink-0" />
          <span className="font-bold text-xs tracking-wider uppercase whitespace-nowrap">
            Press E or Enter
          </span>
        </div>
        <div className="text-center mt-1.5 text-[10px] font-semibold text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md backdrop-blur-sm">
          {config.label} • {gameCount} {gameCount === 1 ? 'game' : 'games'}
        </div>
      </Html>
    </group>
  );
};
