import { useMemo, useRef, useState } from 'react';

import { useGLTF, useAnimations, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { EdgesMesh } from './EdgesMesh';

import type { Mesh } from 'three';

const PS_BLUE = '#003791';
const XBOX_GREEN = '#107C10';
const STEAM_GREY = '#2a475e';
const UNIFIED_AMBER = '#ff6600';

// ─── Valorant-style holographic badge ───
function PlatformHologram({
  position,
  color,
  activeRef,
}: {
  position: [number, number, number];
  color: string;
  activeRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const lerp = THREE.MathUtils.lerp;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    const target = activeRef.current ? 1 : 0;
    const current = groupRef.current.scale.x;
    const s = lerp(current, target, 0.12);
    groupRef.current.scale.setScalar(Math.max(0, s));

    if (activeRef.current && s > 0.01) {
      groupRef.current.position.y = position[1] + Math.sin(t * 3) * 1.5;
      groupRef.current.rotation.y = t * 1.5;

      if (Math.random() > 0.94) {
        groupRef.current.position.x = position[0] + (Math.random() - 0.5) * 0.8;
      } else {
        groupRef.current.position.x = position[0];
      }

      if (scanRef.current) {
        scanRef.current.position.y = ((t * 10) % 14) - 7;
      }
    } else {
      groupRef.current.position.x = position[0];
      groupRef.current.position.y = position[1];
    }
  });

  return (
    <group ref={groupRef} position={position} scale={0}>
      <mesh raycast={() => null}>
        <octahedronGeometry args={[6, 0]} />
        <meshBasicMaterial color={color} wireframe toneMapped={false} />
      </mesh>
      <mesh raycast={() => null}>
        <octahedronGeometry args={[3, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} toneMapped={false} />
      </mesh>
      <mesh ref={scanRef} rotation={[0, 0, Math.PI / 4]} raycast={() => null}>
        <planeGeometry args={[14, 0.25]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={20} distance={30} />
    </group>
  );
}

export function DeconstructedController() {
  const group = useRef<THREE.Group>(null);
  const { nodes: rawNodes, animations } = useGLTF('/models/controller/scene.gltf');
  useAnimations(animations, group);
  const nodes = rawNodes as Record<string, Mesh>;

  const entryProgress = useRef(0);
  const hasEntered = useRef(false);

  const squareActive = useRef(false);
  const triangleActive = useRef(false);
  const crossActive = useRef(false);
  const circleActive = useRef(false);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const squareHover = useMemo(() => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); squareActive.current = true; setHovered(true); },
    onPointerOut: (e: { stopPropagation: () => void }) => { e.stopPropagation(); squareActive.current = false; setHovered(false); },
  }), []);
  const triangleHover = useMemo(() => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); triangleActive.current = true; setHovered(true); },
    onPointerOut: (e: { stopPropagation: () => void }) => { e.stopPropagation(); triangleActive.current = false; setHovered(false); },
  }), []);
  const crossHover = useMemo(() => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); crossActive.current = true; setHovered(true); },
    onPointerOut: (e: { stopPropagation: () => void }) => { e.stopPropagation(); crossActive.current = false; setHovered(false); },
  }), []);
  const circleHover = useMemo(() => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); circleActive.current = true; setHovered(true); },
    onPointerOut: (e: { stopPropagation: () => void }) => { e.stopPropagation(); circleActive.current = false; setHovered(false); },
  }), []);

  useFrame((_state, delta) => {
    const lerp = THREE.MathUtils.lerp;

    // ═══════════════════════════════════════
    // ENTRY ANIMATION — rise from below, settle flat
    // ═══════════════════════════════════════
    if (!hasEntered.current) {
      entryProgress.current = Math.min(entryProgress.current + delta * 0.6, 1);
      const ease = 1 - Math.pow(1 - entryProgress.current, 3);

      if (group.current) {
        group.current.position.y = lerp(-6, 0, ease);
        group.current.rotation.x = lerp(-Math.PI * 1.3, 0, ease);
        group.current.rotation.y = lerp(Math.PI, 0, ease);
        group.current.rotation.z = lerp(Math.PI * 0.3, 0, ease);
      }

      if (entryProgress.current >= 1) {
        hasEntered.current = true;
        if (group.current) {
          group.current.position.y = 0;
          group.current.rotation.set(0, 0, 0);
        }
      }
    }
    // ── No idle animation after entry ──
  });

  return (
    <group ref={group} dispose={null}>
      <group name="Sketchfab_Scene">
        {/* Flat orientation: -Math.PI / 2 on X lays the controller horizontal */}
        <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, Math.PI]} scale={0.907}>
          <group
            name="02b8b04a84f444f58559ae046d9e9522fbx"
            rotation={[Math.PI / 2, 0, 0]}
            scale={0.01}
          >
            <group name="Object_2">
              <group name="RootNode">
                <group name="Dualshock" position={[0, 0, 6.25]}>
                  {/* ═══════════════════════════════════════
                      RIGHT SIDE — interactive platform buttons
                     ═══════════════════════════════════════ */}
                  <group name="RightSide" position={[-87.5, 0, 31.25]}>
                    <group name="RightSideBase">
                      <EdgesMesh
                        geometry={nodes.RightSideBase_Dualshock_Blue_0.geometry}
                        color="#444444"
                        threshold={15}
                      />
                    </group>

                    <group name="Buttons">
                      <group name="Square" {...squareHover}>
                        <EdgesMesh
                          geometry={nodes.Square_Dualshock_Blue_0.geometry}
                          color={PS_BLUE}
                          threshold={15}
                        />
                        <PlatformHologram
                          position={[0, 28, 0]}
                          color={PS_BLUE}
                          activeRef={squareActive}
                        />
                      </group>

                      <group name="Triangle" {...triangleHover}>
                        <EdgesMesh
                          geometry={nodes.Triangle_Dualshock_Blue_0.geometry}
                          color={XBOX_GREEN}
                          threshold={15}
                        />
                        <PlatformHologram
                          position={[0, 28, 0]}
                          color={XBOX_GREEN}
                          activeRef={triangleActive}
                        />
                      </group>

                      <group name="Cross" {...crossHover}>
                        <EdgesMesh
                          geometry={nodes.Cross_Dualshock_Blue_0.geometry}
                          color={STEAM_GREY}
                          threshold={15}
                        />
                        <PlatformHologram
                          position={[0, 28, 0]}
                          color={STEAM_GREY}
                          activeRef={crossActive}
                        />
                      </group>

                      <group name="Circle" {...circleHover}>
                        <EdgesMesh
                          geometry={nodes.Circle_Dualshock_Blue_0.geometry}
                          color={UNIFIED_AMBER}
                          threshold={15}
                        />
                        <PlatformHologram
                          position={[0, 28, 0]}
                          color={UNIFIED_AMBER}
                          activeRef={circleActive}
                        />
                      </group>
                    </group>

                    <group name="RightStick">
                      <group name="R3">
                        <EdgesMesh geometry={nodes.R3_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                      <group name="RightStickBase">
                        <EdgesMesh
                          geometry={nodes.RightStickBase_Dualshock_Blue_0.geometry}
                          threshold={15}
                        />
                      </group>
                    </group>

                    <group name="RightTrigger">
                      <group name="RightTriggerBase">
                        <EdgesMesh
                          geometry={nodes.RightTriggerBase_Dualshock_Blue_0.geometry}
                          threshold={15}
                        />
                      </group>
                      <group name="R1" position={[87.5, 0, -25]}>
                        <EdgesMesh geometry={nodes.R1_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                      <group name="R2" position={[0, -31.25, 43.75]} rotation={[0.175, 0, 0]}>
                        <EdgesMesh geometry={nodes.R2_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                    </group>
                  </group>

                  {/* ═══════════════════════════════════════
                      LEFT SIDE — static
                     ═══════════════════════════════════════ */}
                  <group name="LeftSide" position={[0, 0, 31.25]}>
                    <group name="LeftSideBase" position={[87.5, 0, 0]}>
                      <EdgesMesh
                        geometry={nodes.LeftSideBase_Dualshock_Blue_0.geometry}
                        color="#444444"
                        threshold={15}
                      />
                    </group>

                    <group name="DPad" position={[87.5, 9.375, -25]}>
                      <group name="Up">
                        <EdgesMesh geometry={nodes.Up_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                      <group name="Down" rotation={[-Math.PI, 0, -Math.PI]}>
                        <EdgesMesh geometry={nodes.Down_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                      <group name="Right" rotation={[0, -Math.PI / 2, 0]}>
                        <EdgesMesh
                          geometry={nodes.Right_Dualshock_Blue_0.geometry}
                          threshold={15}
                        />
                      </group>
                      <group name="Left" rotation={[0, Math.PI / 2, 0]}>
                        <EdgesMesh geometry={nodes.Left_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                    </group>

                    <group name="LeftStick" position={[87.5, 0, 0]}>
                      <group name="L3">
                        <EdgesMesh geometry={nodes.L3_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                      <group name="LeftStickBase">
                        <EdgesMesh
                          geometry={nodes.LeftStickBase_Dualshock_Blue_0.geometry}
                          threshold={15}
                        />
                      </group>
                    </group>

                    <group name="LeftTrigger" position={[87.5, 0, 0]}>
                      <group name="LeftTriggerBase">
                        <EdgesMesh
                          geometry={nodes.LeftTriggerBase_Dualshock_Blue_0.geometry}
                          threshold={15}
                        />
                      </group>
                      <group name="L1" position={[-87.5, 0, -25]}>
                        <EdgesMesh geometry={nodes.L1_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                      <group name="L2" position={[0, -31.25, 43.75]} rotation={[0.175, 0, 0]}>
                        <EdgesMesh geometry={nodes.L2_Dualshock_Blue_0.geometry} threshold={15} />
                      </group>
                    </group>
                  </group>

                  {/* ═══════════════════════════════════════
                      CENTER — static
                     ═══════════════════════════════════════ */}
                  <group name="Center" position={[0, 0, 6.25]}>
                    <group name="CenterBase">
                      <EdgesMesh
                        geometry={nodes.CenterBase_Dualshock_Blue_0.geometry}
                        color="#444444"
                        threshold={15}
                      />
                    </group>

                    <group name="CenterButtons">
                      <group name="Analog">
                        <EdgesMesh
                          geometry={nodes.Analog_Dualshock_Blue_0.geometry}
                          threshold={15}
                        />
                      </group>
                      <group name="Select">
                        <EdgesMesh
                          geometry={nodes.Select_Dualshock_Blue_0.geometry}
                          threshold={15}
                        />
                      </group>
                      <group name="Start">
                        <EdgesMesh
                          geometry={nodes.Start_Dualshock_Blue_0.geometry}
                          threshold={15}
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
    </group>
  );
}

useGLTF.preload('/models/controller/scene.gltf');
