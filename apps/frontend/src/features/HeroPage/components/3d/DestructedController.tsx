import { useRef, useMemo } from 'react';

import { useGLTF, useAnimations, useScroll } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { EdgesMesh } from './EdgesMesh';

import type { Mesh } from 'three';

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

  // ─── Core & rings ───
  const coreRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);

  const ringBlueMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#003791',
        toneMapped: false,
        transparent: true,
        opacity: 0.8,
      }),
    [],
  );
  const ringGreenMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#107C10',
        toneMapped: false,
        transparent: true,
        opacity: 0.8,
      }),
    [],
  );
  const ringSteamMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#2a475e',
        toneMapped: false,
        transparent: true,
        opacity: 0.8,
      }),
    [],
  );

  // eslint-disable-next-line complexity
  useFrame((state, delta) => {
    const r = scroll.offset;
    const t = state.clock.elapsedTime;
    const lerp = THREE.MathUtils.lerp;

    // ═══════════════════════════════════════
    // ENTRY ANIMATION — rise from below
    // ═══════════════════════════════════════
    if (!hasEntered.current) {
      entryProgress.current = Math.min(entryProgress.current + delta * 0.7, 1);
      const ease = 1 - Math.pow(1 - entryProgress.current, 3);

      if (group.current) {
        // Rise from below the viewport into center
        group.current.position.y = lerp(-4.5, 0, ease);
        // Slight tilt that straightens as it arrives
        group.current.rotation.x = lerp(0.35, 0, ease);
      }

      if (entryProgress.current >= 1) {
        hasEntered.current = true;
      }
    }

    // ═══════════════════════════════════════
    // SCROLL-DRIVEN DECONSTRUCTION
    // ═══════════════════════════════════════

    // ── Phase 1: Shell separation (0.12 – 0.38) ──
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

    // ── Phase 2: Mechanisms float (0.28 – 0.58) ──
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

    // ── Phase 3: Core reveal (0.52 – 0.78) ──
    const coreP = Math.max(0, Math.min((r - 0.52) / 0.26, 1));
    const coreE = 1 - Math.pow(1 - coreP, 3);

    if (coreRef.current) {
      coreRef.current.scale.setScalar(lerp(0, 1, coreE));
      coreRef.current.rotation.y = t * 0.5;
      coreRef.current.rotation.x = t * 0.2;
    }

    // ── Phase 4: Platform rings (0.68 – 1.0) ──
    const ringP = Math.max(0, Math.min((r - 0.68) / 0.32, 1));
    const ringE = 1 - Math.pow(1 - ringP, 3);

    if (ringsRef.current) {
      ringsRef.current.scale.setScalar(lerp(0.3, 1, ringE));
      ringsRef.current.rotation.x = lerp(0, Math.PI / 2, ringE);
      ringsRef.current.rotation.y = t * 0.3 * ringE;
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
                        <EdgesMesh geometry={nodes.Square_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Triangle">
                        <EdgesMesh geometry={nodes.Triangle_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Cross">
                        <EdgesMesh geometry={nodes.Cross_Dualshock_Blue_0.geometry} />
                      </group>
                      <group name="Circle">
                        <EdgesMesh geometry={nodes.Circle_Dualshock_Blue_0.geometry} />
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

                  {/* ═══════════════════════════════════════
                      CORE — warm amber heart
                     ═══════════════════════════════════════ */}
                  <group ref={coreRef} position={[0, 0, 20]} scale={0}>
                    <pointLight color="#ff6600" intensity={30} distance={80} />
                    <mesh>
                      <icosahedronGeometry args={[20, 2]} />
                      <meshBasicMaterial color="#ff6600" wireframe toneMapped={false} />
                    </mesh>
                    <mesh>
                      <icosahedronGeometry args={[12, 1]} />
                      <meshBasicMaterial
                        color="#ff4400"
                        transparent
                        opacity={0.12}
                        toneMapped={false}
                      />
                    </mesh>
                  </group>

                  {/* ═══════════════════════════════════════
                      PLATFORM RINGS — orbit the core
                     ═══════════════════════════════════════ */}
                  <group ref={ringsRef} position={[0, 0, 20]} scale={0}>
                    <group rotation={[Math.PI / 2, 0, 0]}>
                      <lineSegments rotation={[0, 0, 0]}>
                        <torusGeometry args={[50, 1.2, 8, 64]} />
                        <primitive object={ringBlueMat} attach="material" />
                      </lineSegments>
                      <lineSegments rotation={[Math.PI / 3, 0, 0]}>
                        <torusGeometry args={[58, 1.2, 8, 64]} />
                        <primitive object={ringGreenMat} attach="material" />
                      </lineSegments>
                      <lineSegments rotation={[Math.PI / 6, 0, 0]}>
                        <torusGeometry args={[66, 1.2, 8, 64]} />
                        <primitive object={ringSteamMat} attach="material" />
                      </lineSegments>
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
