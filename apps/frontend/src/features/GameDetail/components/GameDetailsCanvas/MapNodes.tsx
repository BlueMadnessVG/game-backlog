import { useRef, useState, useMemo } from 'react';

import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

import type { Achievement } from '@repo/shared';

// ==========================================
// CONFIGURACIONES Y CONSTANTES (Clean Code)
// ==========================================

const STATUS_COLORS: Record<'ACTIVE' | 'INACTIVE' | 'DISABLED', string> = {
  ACTIVE: '#22c55e',
  INACTIVE: '#ef4444',
  DISABLED: '#6b7280',
};

const STATUS_EMISSIVE: Record<'ACTIVE' | 'INACTIVE' | 'DISABLED', THREE.Color> = {
  ACTIVE: new THREE.Color(0.1, 0.6, 0.1),
  INACTIVE: new THREE.Color(0.6, 0.05, 0.05),
  DISABLED: new THREE.Color(0.15, 0.15, 0.15),
};

// Centralización de medidas para control de escala global de los nodos
const NODE_DIMENSIONS = {
  yPosition: 6,
  glowRadius: 0.95, // Antes: 0.55
  ringInnerRadius: 0.4, // Antes: 0.22
  ringOuterRadius: 0.5, // Antes: 0.28
  boxSize: 0.8, // Antes: 0.22
  boxThickness: 0.1, // Antes: 0.04
  bracketSize: 0.52, // Antes: 0.28
  bracketThickness: 0.04, // Antes: 0.03
  bracketLength: 0.14, // Antes: 0.08
  labelOffset: [0.55, 0.55, 0] as [number, number, number],
};

// ==========================================
// UTILS / FUNCIONES EXTRACTADAS
// ==========================================

const getAchievementStatus = (achievement: Achievement): 'ACTIVE' | 'INACTIVE' | 'DISABLED' => {
  if (achievement.hidden) return 'DISABLED';
  return achievement.achieved ? 'ACTIVE' : 'INACTIVE';
};

const generatePosition = (id: string): [number, number, number] => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const x = (rng(hash) - 0.5) * 30;
  const z = (rng(hash + 1) - 0.5) * 30;
  return [x, 0, z];
};

interface CornerConfig {
  pos: [number, number, number];
  rot: [number, number, number];
}

const calculateCornerTransforms = (size: number): CornerConfig[] => [
  { pos: [-size / 2, 0, -size / 2], rot: [0, 0, 0] },
  { pos: [size / 2, 0, -size / 2], rot: [0, Math.PI / 2, 0] },
  { pos: [size / 2, 0, size / 2], rot: [0, Math.PI, 0] },
  { pos: [-size / 2, 0, size / 2], rot: [0, -Math.PI / 2, 0] },
];

// ==========================================
// COMPONENTES
// ==========================================

interface NodeMarkerProps {
  node: Achievement;
  isSelected: boolean;
  onClick: (node: Achievement) => void;
}

export function NodeMarker({ node, isSelected, onClick }: NodeMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const status = useMemo(() => getAchievementStatus(node), [node]);
  const position = useMemo(() => generatePosition(node.id), [node]);
  const { yPosition } = NODE_DIMENSIONS;

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return; // Early return para evitar nesting innecesario

    const elapsedTime = clock.getElapsedTime();

    // Float animation
    group.position.y = yPosition + Math.sin(elapsedTime * 1.2 + position[0]) * 0.08;

    // Ring pulse animation
    if (ringRef.current) {
      const baseScale = 1 + Math.sin(elapsedTime * 2.5) * 0.12;
      const finalScale = isSelected || hovered ? baseScale * 1.3 : baseScale;
      ringRef.current.scale.setScalar(finalScale);
    }

    // Glow breathe animation
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = status === 'ACTIVE' ? 0.15 + Math.sin(elapsedTime * 1.8) * 0.1 : 0.05;
    }
  });

  const emissiveColor = STATUS_EMISSIVE[status];
  const hexColor = STATUS_COLORS[status];

  const handleNodeClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick(node);
  };

  const handlePointerOver = () => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'default';
  };

  return (
    <group
      ref={groupRef}
      position={[position[0], yPosition, position[2]]}
      onClick={handleNodeClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Glow halo underneath */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <circleGeometry args={[NODE_DIMENSIONS.glowRadius, 24]} />
        <meshBasicMaterial color={hexColor} transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {/* Outer ring (pulsing) */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[NODE_DIMENSIONS.ringInnerRadius, NODE_DIMENSIONS.ringOuterRadius, 32]}
        />
        <meshBasicMaterial color={hexColor} transparent opacity={0.7} depthWrite={false} />
      </mesh>

      {/* Inner square marker */}
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry
          args={[NODE_DIMENSIONS.boxSize, NODE_DIMENSIONS.boxSize, NODE_DIMENSIONS.boxThickness]}
        />
        <meshStandardMaterial
          color="#111318"
          emissive={emissiveColor}
          emissiveIntensity={isSelected || hovered ? 1.5 : 0.8}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      {/* Corner brackets (decorative) */}
      <CornerBrackets color={hexColor} active={status === 'ACTIVE'} />

      {/* Vertical line down to ground */}
      <LineToGround color={hexColor} yPos={yPosition} />

      {/* Label above node */}
      <Html
        position={NODE_DIMENSIONS.labelOffset}
        distanceFactor={12}
        occlude={false}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '10px', // Escalado ligeramente para concordar con el nuevo nodo
            color: hovered || isSelected ? '#e2e8f0' : '#94a3b8',
            whiteSpace: 'nowrap',
            letterSpacing: '0.05em',
            textShadow: `0 0 8px ${hexColor}88`,
            transition: 'color 0.2s',
            userSelect: 'none',
          }}
        >
          {node.name}
        </div>
      </Html>
    </group>
  );
}

function CornerBrackets({ color, active }: { color: string; active: boolean }) {
  const { bracketSize: size, bracketThickness: thick, bracketLength: len } = NODE_DIMENSIONS;

  const corners = useMemo(() => calculateCornerTransforms(size), [size]);

  return (
    <>
      {corners.map((corner, index) => (
        <group key={index} position={corner.pos} rotation={corner.rot}>
          {/* Horizontal arm */}
          <mesh position={[len / 2, 0, 0]}>
            <boxGeometry args={[len, thick * 0.5, thick * 0.5]} />
            <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.4} />
          </mesh>
          {/* Vertical arm */}
          <mesh position={[0, 0, len / 2]}>
            <boxGeometry args={[thick * 0.5, thick * 0.5, len]} />
            <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.4} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function LineToGround({ color, yPos }: { color: string; yPos: number }) {
  const geometry = useMemo(() => {
    const points = [new THREE.Vector3(0, -yPos, 0), new THREE.Vector3(0, 0, 0)];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [yPos]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 }),
    [color],
  );

  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  return <primitive object={lineObject} />;
}

interface MapNodesProps {
  achievements: Achievement[];
  selectedId: string | null;
  onSelect: (node: Achievement | null) => void;
}

export function MapNodes({ achievements, selectedId, onSelect }: MapNodesProps) {
  return (
    <>
      {achievements.map((achievement) => (
        <NodeMarker
          key={achievement.id} // Corregido de index a id único por principios de React/SOLID
          node={achievement}
          isSelected={selectedId === achievement.id}
          onClick={(selectedNode) => onSelect(selectedId === selectedNode.id ? null : selectedNode)}
        />
      ))}
    </>
  );
}
