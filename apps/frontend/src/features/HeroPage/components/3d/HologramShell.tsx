import { Line, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

import { OUTER_Y, PLATE_H, PLATE_THICK, PLATE_W } from './PlatformHologram';

export default function HologramShell({
  color,
  bracketPoints,
  framePoints,
  blobPoints,
  sweepTexture,
  label,
  percent,
  opacity = 1,
  ...groupProps
}: {
  color: string;
  bracketPoints: [THREE.Vector3, THREE.Vector3, THREE.Vector3][];
  framePoints: THREE.Vector3[];
  blobPoints: THREE.Vector3[];
  sweepTexture: THREE.CanvasTexture;
  label: string;
  percent: number;
  opacity?: number;
} & React.ComponentProps<'group'>) {
  return (
    <group {...groupProps}>
      <mesh raycast={() => null}>
        <boxGeometry args={[PLATE_W, PLATE_H, PLATE_THICK]} />
        <meshBasicMaterial color={color} transparent opacity={0.06 * opacity} toneMapped={false} />
      </mesh>
      <mesh raycast={() => null}>
        <boxGeometry args={[PLATE_W, PLATE_H, PLATE_THICK]} />
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={0.9 * opacity}
          toneMapped={false}
        />
      </mesh>

      {bracketPoints.map((pts, i) => (
        <group key={i}>
          <Line
            points={pts}
            color={color}
            lineWidth={6}
            transparent
            opacity={0.25 * opacity}
            toneMapped={false}
          />
          <Line
            points={pts}
            color={color}
            lineWidth={2.5}
            transparent
            opacity={0.9 * opacity}
            toneMapped={false}
          />
        </group>
      ))}

      <group position={[0, 1.5, 0.3]}>
        <Line
          points={framePoints}
          color={color}
          lineWidth={1.5}
          transparent
          opacity={0.9 * opacity}
          toneMapped={false}
        />
        <Line
          points={blobPoints}
          color={color}
          lineWidth={5}
          transparent
          opacity={0.2 * opacity}
          toneMapped={false}
        />
        <Line
          points={blobPoints}
          color={color}
          lineWidth={1.8}
          transparent
          opacity={0.95 * opacity}
          toneMapped={false}
        />
      </group>

      <Billboard position={[0, -OUTER_Y - 2, 0.5]}>
        <Text
          fontSize={0.6}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0}
          letterSpacing={0.05}
          fillOpacity={opacity}
        >
          {`${label} — ${percent}%`}
        </Text>
      </Billboard>

      <mesh position={[0, 0, 0.3]} rotation={[0, 0, Math.PI / 4]} raycast={() => null}>
        <planeGeometry args={[PLATE_W + 3, 0.3]} />
        <meshBasicMaterial
          map={sweepTexture}
          color={color}
          transparent
          opacity={0.5 * opacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
