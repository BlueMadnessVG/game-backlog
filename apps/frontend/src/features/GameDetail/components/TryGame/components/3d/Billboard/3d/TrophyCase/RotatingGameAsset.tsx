import React, { useRef, useMemo } from 'react';

import { useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { Game } from '@repo/shared';

interface RotatingGameAssetProps {
  readonly game: Game | undefined;
}

interface CartridgeGLTFResult {
  nodes: {
    BezierCurve002_Material_0: THREE.Mesh;
    BezierCurve002_LogoMaterial_0: THREE.Mesh;
    BezierCurve001_Material_0: THREE.Mesh;
    BezierCurve001_LogoMaterial_0: THREE.Mesh;
    BezierCurve_Material_0: THREE.Mesh;
    BezierCurve_LogoMaterial_0: THREE.Mesh;
  };
  materials: {
    Material: THREE.MeshStandardMaterial;
    LogoMaterial: THREE.MeshStandardMaterial;
  };
}

export const N64Cartridge: React.FC<RotatingGameAssetProps> = ({ game }) => {
  const cartOneRef = useRef<THREE.Group>(null);

  // Load the asset from your local public path structure
  const { nodes, materials } = useGLTF(
    '/models/n64-cartuches/scene.gltf',
  ) as unknown as CartridgeGLTFResult;

  const coverUrl = game?.coverUrl ?? '/textures/fallback-cover.jpg';
  const rawTexture = useTexture(coverUrl);

  const customMaterials = useMemo(() => {
    const plasticMat = materials.Material.clone();
    const logoMat = materials.LogoMaterial.clone();

    const labelTexture = rawTexture.clone();
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    labelTexture.flipY = false;
    labelTexture.needsUpdate = true;

    logoMat.map = labelTexture;
    plasticMat.roughness = 0.4;
    logoMat.roughness = 0.25;
    logoMat.metalness = 0.1;

    return { plasticMat, logoMat };
  }, [materials, rawTexture]);

  useFrame((state) => {
    if (!cartOneRef.current) return;
    cartOneRef.current.rotation.z = state.clock.getElapsedTime() * 0.5;
  });

  return (
    <group scale={[0.0022, 0.0022, 0.0022]} dispose={null}>
      <group position={[-288.571, 0, 156.584]} rotation={[Math.PI, -1.36, Math.PI]} scale={100}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.BezierCurve002_Material_0.geometry}
          material={customMaterials.plasticMat}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.BezierCurve002_LogoMaterial_0.geometry}
          material={customMaterials.logoMat}
        />
      </group>
      <group position={[-59.642, 0, -75.148]} rotation={[0, 0.483, 0]} scale={100}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.BezierCurve001_Material_0.geometry}
          material={customMaterials.plasticMat}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.BezierCurve001_LogoMaterial_0.geometry}
          material={customMaterials.logoMat}
        />
      </group>
      <group ref={cartOneRef} rotation={[-Math.PI / 2, 0, 0]} scale={100}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.BezierCurve_Material_0.geometry}
          material={customMaterials.plasticMat}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.BezierCurve_LogoMaterial_0.geometry}
          material={customMaterials.logoMat}
        />
      </group>
    </group>
  );
};

useGLTF.preload('/models/n64-cartuches/scene.gltf');
