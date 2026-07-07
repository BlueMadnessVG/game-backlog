// components/3d/Debug/CollisionBoxHelper.tsx
import React, { useMemo } from 'react';

import * as THREE from 'three';

interface CollisionBoxHelperProps {
  readonly position: [number, number, number] | THREE.Vector3;
  readonly size: [number, number, number] | THREE.Vector3;
  readonly rotation?: [number, number, number] | THREE.Euler;
  readonly color?: string;
}

export const CollisionBoxHelper: React.FC<CollisionBoxHelperProps> = ({
  position,
  size,
  rotation = [0, 0, 0],
  color = '#22c55e', // Verde esmeralda por defecto para colisiones
}) => {
  // Asegurar formato correcto de los argumentos para boxGeometry
  const geometryArgs = useMemo(() => {
    if (size instanceof THREE.Vector3) return [size.x, size.y, size.z] as const;
    return size;
  }, [size]);

  const parsedRotation = useMemo(() => {
    if (rotation instanceof THREE.Euler) return rotation;
    return new THREE.Euler(rotation[0], rotation[1], rotation[2]);
  }, [rotation]);

  return (
    <mesh position={position} rotation={parsedRotation}>
      <boxGeometry args={[...geometryArgs]} />
      <meshBasicMaterial
        color={color}
        wireframe
        transparent
        opacity={0.6}
        depthTest={false} // Hace que la caja sea visible a través del coche/anuncio
      />
    </mesh>
  );
};
