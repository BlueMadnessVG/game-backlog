/**
 * Low-poly truck (car "Drifter") — adapted from the auto-generated JSX at
 * https://gltf.pmnd.rs
 *
 * Author:  Ivan Norman  https://sketchfab.com/vanidza
 * License: CC-BY-NC-4.0  http://creativecommons.org/licenses/by-nc/4.0/
 * Source:  https://sketchfab.com/3d-models/low-poly-truck-car-drifter-f3750246b6564607afbefc61cb1683b1
 *
 * SRP : renders the visual model only — no physics, no controls.
 * ISP : accepts CarModelProps extending strict references configuration hooks.
 */

import React, { useRef } from 'react';

import { useGLTF } from '@react-three/drei';

import { useCarProceduralAnimation } from '../../../hooks/useCarProceduralAnimation';
import { DEFAULT_CAR_MODEL_CONFIG } from '../../../types/carModel';

import type { CarModelConfig } from '../../../types/carModel';
import type { KeyboardControls } from '../../../types/vehicle';
import type * as THREE from 'three';

// ── Strict types for the nodes / materials this specific model exposes ────

interface DrifterNodes extends Record<string, THREE.Object3D> {
  Front_wheel_Black_0: THREE.Mesh;
  Front_wheel_Light_black_0: THREE.Mesh;
  Rear_wheel_Black_0: THREE.Mesh;
  Rear_wheel_Light_black_0: THREE.Mesh;
  Front_wheel001_Black_0: THREE.Mesh;
  Front_wheel001_Light_black_0: THREE.Mesh;
  Rear_wheel001_Black_0: THREE.Mesh;
  Rear_wheel001_Light_black_0: THREE.Mesh;
  Spring_Light_black_0: THREE.Mesh;
  Spring_Black_0: THREE.Mesh;
  Spring001_Light_black_0: THREE.Mesh;
  Spring001_Black_0: THREE.Mesh;
  Spring002_Light_black_0: THREE.Mesh;
  Spring002_Black_0: THREE.Mesh;
  Spring003_Light_black_0: THREE.Mesh;
  Spring003_Black_0: THREE.Mesh;
  Smoke001_Smoke_0: THREE.Mesh;
  Smoke002_Smoke_0: THREE.Mesh;
  Smoke003_Smoke_0: THREE.Mesh;
  Smoke004_Smoke_0: THREE.Mesh;
  Smoke005_Smoke_0: THREE.Mesh;
  Smoke006_Smoke_0: THREE.Mesh;
  Smoke007_Smoke_0: THREE.Mesh;
  Smoke008_Smoke_0: THREE.Mesh;
  Smoke009_Smoke_0: THREE.Mesh;
  Smoke010_Smoke_0: THREE.Mesh;
  Smoke011_Smoke_0: THREE.Mesh;
  Smoke012_Smoke_0: THREE.Mesh;
  Frame_Orange_0: THREE.Mesh;
  Frame_Black_0: THREE.Mesh;
  Frame_Glass_0: THREE.Mesh;
  Frame_Light_0: THREE.Mesh;
  Frame_Light_red_0: THREE.Mesh;
  Frame_Dark_brown_0: THREE.Mesh;
  Frame_Dark_brown_handle_0: THREE.Mesh;
  Frame_Glass_trailer_0: THREE.Mesh;
  Frame_Light_black_0: THREE.Mesh;
  Frame_Brown_0: THREE.Mesh;
}

interface DrifterMaterials extends Record<string, THREE.Material> {
  Black: THREE.Material;
  Light_black: THREE.Material;
  Smoke: THREE.Material;
  Orange: THREE.Material;
  Glass: THREE.Material;
  Light: THREE.Material;
  Light_red: THREE.Material;
  Dark_brown: THREE.Material;
  Dark_brown_handle: THREE.Material;
  Glass_trailer: THREE.Material;
  Brown: THREE.Material;
}

export interface CarModelProps {
  readonly config?: Readonly<CarModelConfig>;
  /** Shared mutable pointer tracing current scalar linear tracking vectors */
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  /** Reference tracing keyboard/input tracking context states */
  readonly controlsRef: React.RefObject<KeyboardControls>;
}

export const CarModel: React.FC<CarModelProps> = ({
  config = DEFAULT_CAR_MODEL_CONFIG,
  sharedSpeedRef,
  controlsRef,
}) => {
  const rootGroupRef = useRef<THREE.Group>(null);

  // Specific wheel node references to apply structural animations
  const flWheelRef = useRef<THREE.Group>(null);
  const rlWheelRef = useRef<THREE.Group>(null);
  const frWheelRef = useRef<THREE.Group>(null);
  const rrWheelRef = useRef<THREE.Group>(null);

  // Decoupled chassis layers to protect continuous idle from speed fluctuations
  const chassisIdleGroupRef = useRef<THREE.Group>(null);
  const chassisMotionGroupRef = useRef<THREE.Group>(null);

  const { nodes, materials } = useGLTF(config.url) as unknown as {
    nodes: DrifterNodes;
    materials: DrifterMaterials;
  };

  // Bind procedural transformation layers loop
  useCarProceduralAnimation(
    {
      frontLeftWheelRef: flWheelRef,
      frontRightWheelRef: frWheelRef,
      rearLeftWheelRef: rlWheelRef,
      rearRightWheelRef: rrWheelRef,
      chassisIdleRef: chassisIdleGroupRef,
      chassisMotionRef: chassisMotionGroupRef,
    },
    sharedSpeedRef,
    controlsRef,
  );

  return (
    <group
      ref={rootGroupRef}
      scale={config.scale}
      position={[0, config.yOffset, 0]}
      rotation={[0, config.rotationYOffset, 0]}
      dispose={null}
    >
      <group name="Sketchfab_Scene">
        <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, 0]}>
          <group name="7f09d404031140d78a7bb6db74b81fa4fbx" rotation={[Math.PI / 2, 0, 0]}>
            <group name="Object_2">
              <group name="RootNode">
                {/* ── Front-left wheel ───────────────────────────────── */}
                <group
                  ref={flWheelRef}
                  name="Front_wheel"
                  position={[155.621, 9.27, -127.28]}
                  rotation={[0, 0, -1.403]}
                  scale={[50.096, 50.096, 27.014]}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Front_wheel_Black_0.geometry}
                    material={materials.Black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Front_wheel_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                </group>

                {/* ── Rear-left wheel ────────────────────────────────── */}
                <group
                  ref={rlWheelRef}
                  name="Rear_wheel"
                  position={[-128.512, 14.271, -125.978]}
                  rotation={[0, 0, -2.159]}
                  scale={[55.106, 55.106, 29.617]}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Rear_wheel_Black_0.geometry}
                    material={materials.Black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Rear_wheel_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                </group>

                {/* ── Front-right wheel ──────────────────────────────── */}
                <group
                  ref={frWheelRef}
                  name="Front_wheel001"
                  position={[155.621, 9.27, 127.28]}
                  rotation={[Math.PI, 0, 1.308]}
                  scale={[50.096, 50.096, 27.014]}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Front_wheel001_Black_0.geometry}
                    material={materials.Black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Front_wheel001_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                </group>

                {/* ── Rear-right wheel ───────────────────────────────── */}
                <group
                  ref={rrWheelRef}
                  name="Rear_wheel001"
                  position={[-128.512, 14.271, 125.978]}
                  rotation={[Math.PI, 0, 2.127]}
                  scale={[55.106, 55.106, 29.617]}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Rear_wheel001_Black_0.geometry}
                    material={materials.Black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Rear_wheel001_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                </group>

                {/* ── Suspension springs ─────────────────────────────── */}
                <group
                  name="Spring"
                  position={[155.621, 20.722, -81.958]}
                  rotation={[-0.209, Math.PI / 2, 0]}
                  scale={2.803}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring_Black_0.geometry}
                    material={materials.Black}
                  />
                </group>
                <group
                  name="Spring001"
                  position={[-128.512, 20.722, -81.958]}
                  rotation={[-0.209, Math.PI / 2, 0]}
                  scale={2.803}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring001_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring001_Black_0.geometry}
                    material={materials.Black}
                  />
                </group>
                <group
                  name="Spring002"
                  position={[155.621, 20.722, 81.958]}
                  rotation={[0.209, -Math.PI / 2, 0]}
                  scale={2.803}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring002_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring002_Black_0.geometry}
                    material={materials.Black}
                  />
                </group>
                <group
                  name="Spring003"
                  position={[-128.512, 20.722, 81.958]}
                  rotation={[0.209, -Math.PI / 2, 0]}
                  scale={2.803}
                >
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring003_Light_black_0.geometry}
                    material={materials.Light_black}
                  />
                  <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Spring003_Black_0.geometry}
                    material={materials.Black}
                  />
                </group>

                {/* ── Exhaust smoke particles ────────────────────────── */}
                {[
                  {
                    name: 'Smoke001',
                    position: [70.408, 165.259, 94.261] as [number, number, number],
                  },
                  {
                    name: 'Smoke002',
                    position: [74.602, 165.67, 92.365] as [number, number, number],
                  },
                  {
                    name: 'Smoke003',
                    position: [72.18, 166.534, 95.135] as [number, number, number],
                  },
                  {
                    name: 'Smoke004',
                    position: [73.14, 165.638, 93.102] as [number, number, number],
                  },
                  {
                    name: 'Smoke005',
                    position: [75.198, 166.038, 95.17] as [number, number, number],
                  },
                  {
                    name: 'Smoke006',
                    position: [75.865, 167.365, 89.869] as [number, number, number],
                  },
                  {
                    name: 'Smoke007',
                    position: [74.987, 167.942, 90.928] as [number, number, number],
                  },
                  {
                    name: 'Smoke008',
                    position: [73.567, 166.392, 94.528] as [number, number, number],
                  },
                  {
                    name: 'Smoke009',
                    position: [70.765, 159.593, 95.076] as [number, number, number],
                  },
                  {
                    name: 'Smoke010',
                    position: [72.875, 163.489, 92.993] as [number, number, number],
                  },
                  {
                    name: 'Smoke011',
                    position: [75.049, 162.613, 91.645] as [number, number, number],
                  },
                  {
                    name: 'Smoke012',
                    position: [73.821, 161.817, 89.947] as [number, number, number],
                  },
                ].map(({ name, position }) => {
                  const meshKey = `${name}_Smoke_0` as keyof DrifterNodes;
                  const mesh = nodes[meshKey] as THREE.Mesh | undefined;
                  if (!mesh) return null;
                  return (
                    <group key={name} name={name} position={position} scale={0}>
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={mesh.geometry}
                        material={materials.Smoke}
                      />
                    </group>
                  );
                })}

                {/* ── LayerED Chassis Structure (Idle + Motion isolation) ── */}
                <group ref={chassisIdleGroupRef} name="Chassis_Idle_Layer">
                  <group ref={chassisMotionGroupRef} name="Chassis_Motion_Layer">
                    <group name="Frame" rotation={[-Math.PI / 2, 0, 0]} scale={[300, 100, 50]}>
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Orange_0.geometry}
                        material={materials.Orange}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Black_0.geometry}
                        material={materials.Black}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Glass_0.geometry}
                        material={materials.Glass}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Light_0.geometry}
                        material={materials.Light}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Light_red_0.geometry}
                        material={materials.Light_red}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Dark_brown_0.geometry}
                        material={materials.Dark_brown}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Dark_brown_handle_0.geometry}
                        material={materials.Dark_brown_handle}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Glass_trailer_0.geometry}
                        material={materials.Glass_trailer}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Light_black_0.geometry}
                        material={materials.Light_black}
                      />
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Frame_Brown_0.geometry}
                        material={materials.Brown}
                      />
                    </group>
                  </group>
                </group>
                {/* ──────────────────────────────────────────────────────── */}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function preloadCarModel(url: string): void {
  useGLTF.preload(url);
}
