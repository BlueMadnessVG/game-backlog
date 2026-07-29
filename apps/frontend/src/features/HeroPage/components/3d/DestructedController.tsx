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

const shellMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#0a0a0a',
    metalness: 0.9,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
  });

const rightShellMat = shellMaterial();
const leftShellMat = shellMaterial();
const centerShellMat = shellMaterial();

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

  const updateEntry = (delta: number) => {
    if (hasEntered.current) return;
    entryProgress.current = Math.min(entryProgress.current + delta * 0.6, 1);
    const ease = 1 - Math.pow(1 - entryProgress.current, 3);
    const lerp = THREE.MathUtils.lerp;

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
  };

  const updateTransparency = (r: number) => {
    const lerp = THREE.MathUtils.lerp;

    const glassP = Math.max(0, Math.min((r - 0.1) / 0.22, 1));
    const glassE = 1 - Math.pow(1 - glassP, 3);

    const bodyOpacity =
      glassP < 0.55 ? lerp(1, 0.15, glassP / 0.55) : lerp(0.15, 0, (glassP - 0.55) / 0.45);

    rightShellMat.opacity = bodyOpacity;
    leftShellMat.opacity = bodyOpacity;
    centerShellMat.opacity = bodyOpacity;

    if (rightShellRef.current) rightShellRef.current.position.z = lerp(0, -18, glassE);
    if (leftShellRef.current) leftShellRef.current.position.z = lerp(0, -18, glassE);
    if (centerShellRef.current) centerShellRef.current.position.z = lerp(0, -14, glassE);
  };

  const updateMechanisms = (r: number) => {
    const lerp = THREE.MathUtils.lerp;
    const pushP = Math.max(0, Math.min((r - 0.22) / 0.33, 1));
    const pushE = 1 - Math.pow(1 - pushP, 3);

    if (rightButtonsRef.current) {
      rightButtonsRef.current.position.z = lerp(0, 48, pushE);
      rightButtonsRef.current.position.y = lerp(0, 10, pushE);
    }
    if (rightStickRef.current) {
      rightStickRef.current.position.z = lerp(0, 38, pushE);
      rightStickRef.current.position.y = lerp(0, 6, pushE);
      rightStickRef.current.position.x = lerp(0, 6, pushE);
    }
    if (rightTriggerRef.current) {
      rightTriggerRef.current.position.z = lerp(0, 42, pushE);
      rightTriggerRef.current.position.y = lerp(0, 14, pushE);
      rightTriggerRef.current.rotation.x = lerp(0, 0.35, pushE);
    }
    if (leftDPadRef.current) {
      leftDPadRef.current.position.z = lerp(-25, 22, pushE);
      leftDPadRef.current.position.y = lerp(9.375, 20, pushE);
    }
    if (leftStickRef.current) {
      leftStickRef.current.position.z = lerp(0, 38, pushE);
      leftStickRef.current.position.y = lerp(0, 6, pushE);
      leftStickRef.current.position.x = lerp(87.5, 82, pushE);
    }
    if (leftTriggerRef.current) {
      leftTriggerRef.current.position.z = lerp(0, 42, pushE);
      leftTriggerRef.current.position.y = lerp(0, 14, pushE);
      leftTriggerRef.current.rotation.x = lerp(0, 0.35, pushE);
    }
    if (centerButtonsRef.current) {
      centerButtonsRef.current.position.z = lerp(0, 40, pushE);
      centerButtonsRef.current.position.y = lerp(0, 8, pushE);
    }
  };

  const updateHoverFloat = (r: number, elapsed: number) => {
    if (r <= 0.48) return;
    const hoverAmp = Math.min((r - 0.48) / 0.2, 1) * 0.4;

    if (rightButtonsRef.current)
      rightButtonsRef.current.position.y += Math.sin(elapsed * 0.7) * 0.02 * hoverAmp;
    if (leftDPadRef.current)
      leftDPadRef.current.position.y += Math.sin(elapsed * 0.8 + 1.2) * 0.02 * hoverAmp;
    if (rightStickRef.current)
      rightStickRef.current.position.y += Math.sin(elapsed * 0.65 + 2.1) * 0.015 * hoverAmp;
    if (leftStickRef.current)
      leftStickRef.current.position.y += Math.sin(elapsed * 0.7 + 3.0) * 0.015 * hoverAmp;
    if (centerButtonsRef.current)
      centerButtonsRef.current.position.y += Math.sin(elapsed * 0.75 + 1.8) * 0.012 * hoverAmp;
  };

  useFrame((state, delta) => {
    const r = scroll.offset;

    updateEntry(delta);
    updateTransparency(r);
    updateMechanisms(r);
    updateHoverFloat(r, state.clock.elapsedTime);
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
                    {/* Shell: fading dark-chrome body + edge lines */}
                    <group ref={rightShellRef} name="RightSideBase">
                      <mesh
                        geometry={nodes.RightSideBase_Dualshock_Blue_0.geometry}
                        material={rightShellMat}
                        renderOrder={0}
                      />
                      <EdgesMesh
                        geometry={nodes.RightSideBase_Dualshock_Blue_0.geometry}
                        color="#ffffff"
                        threshold={15}
                      />
                    </group>

                    {/* Mechanisms: push through the fading shell */}
                    <group ref={rightButtonsRef} name="Buttons">
                      <group name="Square">
                        <EdgesMesh
                          geometry={nodes.Square_Dualshock_Blue_0.geometry}
                          color={PS_BLUE}
                          threshold={15}
                        />
                      </group>
                      <group name="Triangle">
                        <EdgesMesh
                          geometry={nodes.Triangle_Dualshock_Blue_0.geometry}
                          color={XBOX_GREEN}
                          threshold={15}
                        />
                      </group>
                      <group name="Cross">
                        <EdgesMesh
                          geometry={nodes.Cross_Dualshock_Blue_0.geometry}
                          color={STEAM_GREY}
                          threshold={15}
                        />
                      </group>
                      <group name="Circle">
                        <EdgesMesh
                          geometry={nodes.Circle_Dualshock_Blue_0.geometry}
                          color={UNIFIED_AMBER}
                          threshold={15}
                        />
                      </group>
                    </group>

                    <group ref={rightStickRef} name="RightStick">
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

                    <group ref={rightTriggerRef} name="RightTrigger">
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
                      LEFT SIDE — shell & mechanisms as siblings
                     ═══════════════════════════════════════ */}
                  <group name="LeftSide" position={[0, 0, 31.25]}>
                    <group ref={leftShellRef} name="LeftSideBase" position={[87.5, 0, 0]}>
                      <mesh
                        geometry={nodes.LeftSideBase_Dualshock_Blue_0.geometry}
                        material={leftShellMat}
                        renderOrder={0}
                      />
                      <EdgesMesh
                        geometry={nodes.LeftSideBase_Dualshock_Blue_0.geometry}
                        color="#ffffff"
                        threshold={15}
                      />
                    </group>

                    <group ref={leftDPadRef} name="DPad" position={[87.5, 9.375, -25]}>
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

                    <group ref={leftStickRef} name="LeftStick" position={[87.5, 0, 0]}>
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

                    <group ref={leftTriggerRef} name="LeftTrigger" position={[87.5, 0, 0]}>
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
                      CENTER — shell & buttons as siblings
                     ═══════════════════════════════════════ */}
                  <group name="Center" position={[0, 0, 6.25]}>
                    <group ref={centerShellRef} name="CenterBase">
                      <mesh
                        geometry={nodes.CenterBase_Dualshock_Blue_0.geometry}
                        material={centerShellMat}
                        renderOrder={0}
                      />
                      <EdgesMesh
                        geometry={nodes.CenterBase_Dualshock_Blue_0.geometry}
                        color="#ffffff"
                        threshold={15}
                      />
                    </group>

                    <group ref={centerButtonsRef} name="CenterButtons">
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
