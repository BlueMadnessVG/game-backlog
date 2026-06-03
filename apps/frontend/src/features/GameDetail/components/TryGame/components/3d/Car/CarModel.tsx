// components/3d/CarModel.tsx
/**
 * Low-poly truck (car "Drifter") — adapted from the auto-generated JSX at
 * https://gltf.pmnd.rs
 *
 * Author:  Ivan Norman  https://sketchfab.com/vanidza
 * License: CC-BY-NC-4.0  http://creativecommons.org/licenses/by-nc/4.0/
 * Source:  https://sketchfab.com/3d-models/low-poly-truck-car-drifter-f3750246b6564607afbefc61cb1683b1
 *
 * Animation architecture — two layers running simultaneously:
 *
 *   Layer A — GLTF clip (useCarAnimation)
 *     Drives the smoke particles and any bone/morph animations baked
 *     into the asset (suspension travel, exhaust puffs, etc.).
 *     Completely independent of speed or input.
 *
 *   Layer B — Procedural (useCarProceduralAnimation)
 *     Drives wheel spin (speed-scaled), front-wheel steer articulation
 *     (input-driven), chassis idle float (constant), and chassis motion
 *     suspension (speed-gated).  These cannot come from a clip because
 *     they must react to live physics values every frame.
 *
 * The two layers target different nodes so they never conflict:
 *   GLTF clip  → smoke groups, bone tracks
 *   Procedural → wheel groups, chassisIdleRef, chassisMotionRef
 */

import React, { useRef } from 'react';

import { useGLTF } from '@react-three/drei';

import { useCarAnimation } from '../../../hooks/useCarAnimation';
import { useCarProceduralAnimation } from '../../../hooks/useCarProceduralAnimation';
import { DEFAULT_CAR_MODEL_CONFIG } from '../../../types/carModel';

import type { CarModelConfig } from '../../../types/carModel';
import type { KeyboardControls } from '../../../types/vehicle';
import type * as THREE from 'three';

// ── Node / material strict types ──────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────

export interface CarModelProps {
  readonly config?: Readonly<CarModelConfig>;
  readonly sharedSpeedRef: React.MutableRefObject<number>;
  readonly controlsRef: React.RefObject<KeyboardControls>;
}

// ── Component ─────────────────────────────────────────────────────────────

export const CarModel: React.FC<CarModelProps> = ({
  config = DEFAULT_CAR_MODEL_CONFIG,
  sharedSpeedRef,
  controlsRef,
}) => {
  // Root ref — passed to useCarAnimation so the mixer is bound to the
  // correct scene graph root (required by useAnimations / drei).
  const rootGroupRef = useRef<THREE.Group>(null);

  // Wheel refs — procedural hook writes spin + steer to these every frame.
  const flWheelRef = useRef<THREE.Group>(null);
  const rlWheelRef = useRef<THREE.Group>(null);
  const frWheelRef = useRef<THREE.Group>(null);
  const rrWheelRef = useRef<THREE.Group>(null);

  // Chassis layer refs — idle float and motion suspension targets.
  const chassisIdleGroupRef = useRef<THREE.Group>(null);
  const chassisMotionGroupRef = useRef<THREE.Group>(null);

  const { nodes, materials, animations } = useGLTF(config.url) as unknown as {
    nodes: DrifterNodes;
    materials: DrifterMaterials;
    animations: THREE.AnimationClip[];
  };

  // ── Layer A: GLTF clip ─────────────────────────────────────────────────
  // Plays the first clip in the asset (smoke puff / suspension bounce).
  // Targets rootGroupRef — drei's useAnimations finds named nodes from here.
  useCarAnimation(animations, rootGroupRef, sharedSpeedRef);

  // ── Layer B: Procedural ────────────────────────────────────────────────
  // Wheel spin, steer articulation, idle bob, motion suspension.
  // Targets wheel refs and chassis layer refs — never touches smoke nodes.
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
                {/* ── Front-left wheel ─────────────────────────────────
                    ref on outer group — procedural hook sets .rotation.z
                    (spin + baked tilt) and .rotation.y (steer) directly. */}
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

                {/* ── Rear-left wheel ──────────────────────────────────── */}
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

                {/* ── Front-right wheel ────────────────────────────────── */}
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

                {/* ── Rear-right wheel ─────────────────────────────────── */}
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

                {/* ── Suspension springs ───────────────────────────────── */}
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

                {/* ── Exhaust smoke particles ───────────────────────────
                    scale=0 at rest; the GLTF clip animates scale up/down. */}
                {(
                  [
                    { name: 'Smoke001', pos: [70.408, 165.259, 94.261] },
                    { name: 'Smoke002', pos: [74.602, 165.67, 92.365] },
                    { name: 'Smoke003', pos: [72.18, 166.534, 95.135] },
                    { name: 'Smoke004', pos: [73.14, 165.638, 93.102] },
                    { name: 'Smoke005', pos: [75.198, 166.038, 95.17] },
                    { name: 'Smoke006', pos: [75.865, 167.365, 89.869] },
                    { name: 'Smoke007', pos: [74.987, 167.942, 90.928] },
                    { name: 'Smoke008', pos: [73.567, 166.392, 94.528] },
                    { name: 'Smoke009', pos: [70.765, 159.593, 95.076] },
                    { name: 'Smoke010', pos: [72.875, 163.489, 92.993] },
                    { name: 'Smoke011', pos: [75.049, 162.613, 91.645] },
                    { name: 'Smoke012', pos: [73.821, 161.817, 89.947] },
                  ] as const
                ).map(({ name, pos }) => {
                  const mesh = nodes[`${name}_Smoke_0` as keyof DrifterNodes] as
                    | THREE.Mesh
                    | undefined;
                  if (!mesh) return null;
                  return (
                    <group
                      key={name}
                      name={name}
                      position={pos as [number, number, number]}
                      scale={0}
                    >
                      <mesh
                        castShadow
                        receiveShadow
                        geometry={mesh.geometry}
                        material={materials.Smoke}
                      />
                    </group>
                  );
                })}

                {/* ── Layered chassis structure ─────────────────────────
                    chassisIdleGroupRef   — idle engine float (always on)
                    chassisMotionGroupRef — road suspension (speed-gated)
                    Both are driven by useCarProceduralAnimation.           */}
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
