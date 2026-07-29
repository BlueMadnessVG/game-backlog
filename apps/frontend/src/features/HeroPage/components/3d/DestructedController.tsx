import { useRef } from 'react';

import { useGLTF, useAnimations, useScroll } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { EdgesMesh } from './EdgesMesh';

import type { Mesh } from 'three';

const PS_BLUE = '#003791';
const XBOX_GREEN = '#107C10';
const STEAM_GREY = '#2a475e';
const UNIFIED_AMBER = '#ff6600';

export function DeconstructedController() {
  const group = useRef<THREE.Group>(null);
  const { nodes: rawNodes, animations } = useGLTF('/models/controller/scene.gltf');
  useAnimations(animations, group);
  const nodes = rawNodes as Record<string, Mesh>;
  const scroll = useScroll();

  // ─── Entry animation state ───
  const entryProgress = useRef(0);
  const hasEntered = useRef(false);

  // ─── Shell refs ───
  const rightShellRef = useRef<THREE.Group>(null);
  const leftShellRef = useRef<THREE.Group>(null);
  const centerShellRef = useRef<THREE.Group>(null);

  // ─── Mechanism refs ───
  const rightButtonsRef = useRef<THREE.Group>(null);
  const rightStickRef = useRef<THREE.Group>(null);
  const rightTriggerRef = useRef<THREE.Group>(null);
  const leftDPadRef = useRef<THREE.Group>(null);
  const leftStickRef = useRef<THREE.Group>(null);
  const leftTriggerRef = useRef<THREE.Group>(null);
  const centerButtonsRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    const r = scroll.offset;
    const lerp = THREE.MathUtils.lerp;

    // ═══════════════════════════════════════
    // ENTRY ANIMATION — rise with flip & spin
    // ═══════════════════════════════════════
    if (!hasEntered.current) {
      entryProgress.current = Math.min(entryProgress.current + delta * 0.6, 1);
      const ease = 1 - Math.pow(1 - entryProgress.current, 3);

      if (group.current) {
        // Rise from deep below
        group.current.position.y = lerp(-6, 0, ease);

        // Backflip: starts upside-down/tipped back, settles flat
        group.current.rotation.x = lerp(-Math.PI * 1.3, 0, ease);

        // Horizontal spin: 180° twist as it rises
        group.current.rotation.y = lerp(Math.PI, 0, ease);

        // Slight roll that straightens out
        group.current.rotation.z = lerp(Math.PI * 0.3, 0, ease);
      }

      if (entryProgress.current >= 1) {
        hasEntered.current = true;
        // Snap to exact zero to avoid micro-jitter
        if (group.current) {
          group.current.position.y = 0;
          group.current.rotation.set(0, 0, 0);
        }
      }
    }

    // ═══════════════════════════════════════
    // SCROLL-DRIVEN DECONSTRUCTION
    // ═══════════════════════════════════════

    const shellP = Math.max(0, Math.min((r - 0.12) / 0.26, 1));
    const shellE = 1 - Math.pow(1 - shellP, 3);

    if (rightShellRef.current) {
      rightShellRef.current.position.x = lerp(0, -55, shellE);
      rightShellRef.current.position.y = lerp(0, 18, shellE);
      rightShellRef.current.rotation.z = lerp(0, -0.06, shellE);
    }
    if (leftShellRef.current) {
      leftShellRef.current.position.x = lerp(87.5, 142.5, shellE);
      leftShellRef.current.position.y = lerp(0, 18, shellE);
      leftShellRef.current.rotation.z = lerp(0, 0.06, shellE);
    }
    if (centerShellRef.current) {
      centerShellRef.current.position.y = lerp(0, -18, shellE);
    }

    const mechP = Math.max(0, Math.min((r - 0.28) / 0.3, 1));
    const mechE = 1 - Math.pow(1 - mechP, 3);

    if (rightButtonsRef.current) {
      rightButtonsRef.current.position.y = lerp(0, 65, mechE);
      rightButtonsRef.current.position.z = lerp(0, 30, mechE);
    }
    if (rightStickRef.current) {
      rightStickRef.current.position.y = lerp(0, 55, mechE);
      rightStickRef.current.position.x = lerp(0, 12, mechE);
    }
    if (rightTriggerRef.current) {
      rightTriggerRef.current.position.y = lerp(0, 50, mechE);
      rightTriggerRef.current.position.z = lerp(0, -18, mechE);
      rightTriggerRef.current.rotation.x = lerp(0, 0.3, mechE);
    }

    if (leftDPadRef.current) {
      leftDPadRef.current.position.y = lerp(9.375, 60, mechE);
      leftDPadRef.current.position.z = lerp(-25, 12, mechE);
    }
    if (leftStickRef.current) {
      leftStickRef.current.position.y = lerp(0, 55, mechE);
      leftStickRef.current.position.x = lerp(87.5, 75.5, mechE);
    }
    if (leftTriggerRef.current) {
      leftTriggerRef.current.position.y = lerp(0, 50, mechE);
      leftTriggerRef.current.position.z = lerp(0, -18, mechE);
      leftTriggerRef.current.rotation.x = lerp(0, 0.3, mechE);
    }

    if (centerButtonsRef.current) {
      centerButtonsRef.current.position.y = lerp(0, 42, mechE);
    }
  });

  return (
    <group ref={group} dispose={null}>
      <group name="Sketchfab_Scene">
        <group name="Sketchfab_model" rotation={[-0.4, 0, Math.PI]} scale={0.907}>
          <group
            name="02b8b04a84f444f58559ae046d9e9522fbx"
            rotation={[Math.PI / 2, 0, 0]}
            scale={0.01}
          >
            <group name="Object_2">
              <group name="RootNode">
                <group name="Dualshock" position={[0, 0, 6.25]}>
                  {/* ═══════════════════════════════════════
                      RIGHT SIDE — shell & mechanisms as siblings
                     ═══════════════════════════════════════ */}
                  <group name="RightSide" position={[-87.5, 0, 31.25]}>
                    <group ref={rightShellRef} name="RightSideBase">
                      <EdgesMesh geometry={nodes.RightSideBase_Dualshock_Blue_0.geometry} />
                    </group>

                    <group ref={rightButtonsRef} name="Buttons">
                      <group name="Square">
                        <EdgesMesh
                          geometry={nodes.Square_Dualshock_Blue_0.geometry}
                          color={PS_BLUE}
                        />
                      </group>
                      <group name="Triangle">
                        <EdgesMesh
                          geometry={nodes.Triangle_Dualshock_Blue_0.geometry}
                          color={XBOX_GREEN}
                        />
                      </group>
                      <group name="Cross">
                        <EdgesMesh
                          geometry={nodes.Cross_Dualshock_Blue_0.geometry}
                          color={STEAM_GREY}
                        />
                      </group>
                      <group name="Circle">
                        <EdgesMesh
                          geometry={nodes.Circle_Dualshock_Blue_0.geometry}
                          color={UNIFIED_AMBER}
                        />
                      </group>
                    </group>

                    <group ref={rightStickRef} name="RightStick">
                      <group name="R3">
                        <EdgesMesh geometry={nodes.R3_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="RightStickBase">
                        <EdgesMesh geometry={nodes.RightStickBase_Dualshock_Blue_0.geometry} />
                      </group>
                    </group>

                    <group ref={rightTriggerRef} name="RightTrigger">
                      <group name="RightTriggerBase">
                        <EdgesMesh geometry={nodes.RightTriggerBase_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="R1" position={[87.5, 0, -25]}>
                        <EdgesMesh geometry={nodes.R1_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="R2" position={[0, -31.25, 43.75]} rotation={[0.175, 0, 0]}>
                        <EdgesMesh geometry={nodes.R2_Dualshock_Blue_0.geometry} />
                      </group>
                    </group>
                  </group>

                  {/* ═══════════════════════════════════════
                      LEFT SIDE — shell & mechanisms as siblings
                     ═══════════════════════════════════════ */}
                  <group name="LeftSide" position={[0, 0, 31.25]}>
                    <group ref={leftShellRef} name="LeftSideBase" position={[87.5, 0, 0]}>
                      <EdgesMesh geometry={nodes.LeftSideBase_Dualshock_Blue_0.geometry} />
                    </group>

                    <group ref={leftDPadRef} name="DPad" position={[87.5, 9.375, -25]}>
                      <group name="Up">
                        <EdgesMesh geometry={nodes.Up_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Down" rotation={[-Math.PI, 0, -Math.PI]}>
                        <EdgesMesh geometry={nodes.Down_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Right" rotation={[0, -Math.PI / 2, 0]}>
                        <EdgesMesh geometry={nodes.Right_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Left" rotation={[0, Math.PI / 2, 0]}>
                        <EdgesMesh geometry={nodes.Left_Dualshock_Blue_0.geometry} />
                      </group>
                    </group>

                    <group ref={leftStickRef} name="LeftStick" position={[87.5, 0, 0]}>
                      <group name="L3">
                        <EdgesMesh geometry={nodes.L3_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="LeftStickBase">
                        <EdgesMesh geometry={nodes.LeftStickBase_Dualshock_Blue_0.geometry} />
                      </group>
                    </group>

                    <group ref={leftTriggerRef} name="LeftTrigger" position={[87.5, 0, 0]}>
                      <group name="LeftTriggerBase">
                        <EdgesMesh geometry={nodes.LeftTriggerBase_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="L1" position={[-87.5, 0, -25]}>
                        <EdgesMesh geometry={nodes.L1_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="L2" position={[0, -31.25, 43.75]} rotation={[0.175, 0, 0]}>
                        <EdgesMesh geometry={nodes.L2_Dualshock_Blue_0.geometry} />
                      </group>
                    </group>
                  </group>

                  {/* ═══════════════════════════════════════
                      CENTER — shell & buttons as siblings
                     ═══════════════════════════════════════ */}
                  <group name="Center" position={[0, 0, 6.25]}>
                    <group ref={centerShellRef} name="CenterBase">
                      <EdgesMesh geometry={nodes.CenterBase_Dualshock_Blue_0.geometry} />
                    </group>

                    <group ref={centerButtonsRef} name="CenterButtons">
                      <group name="Analog">
                        <EdgesMesh geometry={nodes.Analog_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Select">
                        <EdgesMesh geometry={nodes.Select_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Start">
                        <EdgesMesh geometry={nodes.Start_Dualshock_Blue_0.geometry} />
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
