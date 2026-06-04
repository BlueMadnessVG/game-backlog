import React, { useMemo } from 'react';

import { Html, useGLTF } from '@react-three/drei';

import { ArcadeScreen } from './ArcadeScreen';
import styles from './css/ArcadeCabinetMesh.module.css';
import { CollisionBoxHelper } from '../../../debug/CollisionBoxHelper';

import type { BillboardConfig } from '../../../../../types/billboard';
import type { Game } from '@repo/shared';
import type * as THREE from 'three';

const CABINET_SCALE = 0.5;
/* const SCREEN_OFFSET = { x: 0, y: 0.18, z: 0.36 } as const;
const SCREEN_TILT_X = -0.14; */
const MARQUEE_OFFSET = { x: 0, y: 0.72, z: 0.29 } as const;
const PROMPT_OFFSET = { x: 0, y: -0.55, z: 0.38 } as const;
const COLLISION_SIZE: [number, number, number] = [0.85, 1.9, 0.75];

interface ArcadeMaterials extends Record<string, THREE.Material> {
  paint: THREE.Material;
  black_plastic: THREE.Material;
  black_metal: THREE.Material;
  white_metal: THREE.Material;
  lever: THREE.Material;
  button1: THREE.Material;
  button2: THREE.Material;
  button3: THREE.Material;
  button4: THREE.Material;
  material: THREE.Material;
  tv_plastic: THREE.Material;
}

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
    nodes: Record<string, THREE.Mesh>;
    materials: ArcadeMaterials;
  };

  const rotationArray = useMemo(() => rotation as [number, number, number], [rotation]);

  return (
    <group
      position={position as [number, number, number]}
      rotation={rotationArray}
      scale={[CABINET_SCALE, CABINET_SCALE, CABINET_SCALE]}
    >
      <group position={[0, 6.381, 0]} scale={[3.429, 6.438, 3.499]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_4.geometry}
          material={materials.paint}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_5.geometry}
          material={materials.black_plastic}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_6.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_7.geometry}
          material={materials.white_metal}
        />
      </group>

      <group position={[4.441, 5.697, 1.844]} rotation={[0, 0, -0.125]} scale={[0.3, 0.09, 0.3]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_9.geometry}
          material={materials.white_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_10.geometry}
          material={materials.lever}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_11.geometry}
          material={materials.black_metal}
        />
      </group>

      <group position={[4.441, 5.697, -0.578]} rotation={[0, 0, -0.125]} scale={[0.3, 0.09, 0.3]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_13.geometry}
          material={materials.white_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_14.geometry}
          material={materials.lever}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_15.geometry}
          material={materials.black_metal}
        />
      </group>

      <group position={[4.288, 5.764, 1.026]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_17.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_18.geometry}
          material={materials.button1}
        />
      </group>

      <group position={[4.288, 5.764, 0.564]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_20.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_21.geometry}
          material={materials.button2}
        />
      </group>

      <group position={[4.702, 5.713, 0.327]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_23.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_24.geometry}
          material={materials.button4}
        />
      </group>

      <group position={[4.702, 5.713, 0.789]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_26.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_27.geometry}
          material={materials.button3}
        />
      </group>

      <group position={[4.702, 5.713, -2.076]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_29.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_30.geometry}
          material={materials.button4}
        />
      </group>

      <group position={[4.702, 5.713, -1.614]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_32.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_33.geometry}
          material={materials.button3}
        />
      </group>

      <group position={[4.288, 5.764, -1.839]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_35.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_36.geometry}
          material={materials.button2}
        />
      </group>

      <group position={[4.288, 5.764, -1.377]} rotation={[0, 0, -0.125]} scale={0.674}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_38.geometry}
          material={materials.black_metal}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_39.geometry}
          material={materials.button1}
        />
      </group>

      <group position={[1.584, 8.639, 0]} scale={[1, 2.443, 2.767]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_41.geometry}
          material={materials.material}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_42.geometry}
          material={materials.tv_plastic}
        />

        {/* ADAPTED FOR NEW MESH:
          - scale: Counter-balances the parent's non-uniform stretching to achieve a crisp 4:3 area.
          - position: [0.03, 0, 0] brings the panel slightly forward off the interior base logic to stop z-fighting.
          - distanceFactor: Lowered to 1.35 to sharply scale down the HTML DOM size to sit inside the monitor housing.
        */}
        <group scale={[1, 1, 1]} rotation={[0, Math.PI / 2, 0]} position={[0.03, 0, 0]}>
          <Html
            transform
            occlude="blending"
            distanceFactor={2.35}
            style={{
              width: 'full',
              height: 'full',
              pointerEvents: isOpen ? 'auto' : 'none',
            }}
          >
            <ArcadeScreen
              games={games}
              isLoading={isLoading}
              isOpen={isOpen}
              isSelected={isSelected}
              onOpen={onOpen}
              onClose={onClose}
            />
          </Html>
        </group>
      </group>

      <Html
        position={[MARQUEE_OFFSET.x, MARQUEE_OFFSET.y, MARQUEE_OFFSET.z]}
        transform
        occlude
        className={styles.marqueeHtmlWrapper}
      >
        <div className={styles.marquee}>NOW PLAYING</div>
      </Html>

      {showPrompt && games.length > 0 && (
        <Html
          position={[PROMPT_OFFSET.x, PROMPT_OFFSET.y, PROMPT_OFFSET.z]}
          transform
          occlude
          className={styles.promptHtmlWrapper}
        >
          <div className={styles.prompt}>
            <span className={styles.pulseIcon}>⚡</span>
            Press E · View
          </div>
        </Html>
      )}

      {isNearby && (
        <mesh position={[0, 5.0, -0.1]}>
          <planeGeometry args={[4.5, 6.5]} />
          <meshStandardMaterial
            color="#f97316"
            transparent
            opacity={0.08}
            emissive="#f97316"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[3.5, 32]} />
        <meshStandardMaterial
          color="#f97316"
          transparent
          opacity={isSelected ? 0.22 : isNearby ? 0.14 : 0.07}
          emissive="#f97316"
          emissiveIntensity={0.2}
          depthWrite={false}
        />
      </mesh>

      <CollisionBoxHelper
        position={[0, COLLISION_SIZE[1] / 2, 0]}
        size={COLLISION_SIZE}
        color="#f97316"
      />
    </group>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function preloadArcadeCabinet(): void {
  useGLTF.preload('/models/arcade/scene.gltf');
}
