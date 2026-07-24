import { useRef, useMemo } from 'react';

import { useGLTF, useScroll } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ControllerGLTFResult {
  nodes: Record<string, THREE.Mesh>;
}

type DeconstructedControllerProps = Record<string, unknown>;

// ─── Emissive Materials (module-level: mutated imperatively in useFrame) ───
const psBlue = new THREE.MeshStandardMaterial({
  color: '#0a0a0a',
  emissive: '#003791',
  emissiveIntensity: 0,
  metalness: 0.8,
  roughness: 0.3,
});

const xboxGreen = new THREE.MeshStandardMaterial({
  color: '#0a0a0a',
  emissive: '#107C10',
  emissiveIntensity: 0,
  metalness: 0.8,
  roughness: 0.3,
});

const steamGrey = new THREE.MeshStandardMaterial({
  color: '#0a0a0a',
  emissive: '#2a475e',
  emissiveIntensity: 0,
  metalness: 0.8,
  roughness: 0.3,
});

export function DeconstructedController(props: DeconstructedControllerProps) {
  const group = useRef<THREE.Group>(null);
  const { nodes } = useGLTF('/models/controller/scene.gltf') as unknown as ControllerGLTFResult;
  const scroll = useScroll();

  // ─── Materials ───
  const darkChrome = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0f0f0f',
        metalness: 1.0,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0,
      }),
    [],
  );

  const gunmetal = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1a1a1a',
        metalness: 0.9,
        roughness: 0.25,
        clearcoat: 0.5,
      }),
    [],
  );

  const coreMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ff4400',
        emissive: '#ff2200',
        emissiveIntensity: 4,
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );

  const ringBlueMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#003791',
        emissive: '#003791',
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );

  const ringGreenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#107C10',
        emissive: '#107C10',
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );

  const ringSteamMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a475e',
        emissive: '#2a475e',
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );

  // ─── Animation Refs ───
  const shellRightRef = useRef<THREE.Group>(null);
  const shellLeftRef = useRef<THREE.Group>(null);
  const shellCenterRef = useRef<THREE.Group>(null);
  const buttonsRef = useRef<THREE.Group>(null);
  const dpadRef = useRef<THREE.Group>(null);
  const sticksRef = useRef<THREE.Group>(null);
  const triggersRef = useRef<THREE.Group>(null);
  const centerButtonsRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const r = scroll.offset;
    const time = state.clock.elapsedTime;

    const lerp = (a: number, b: number, t: number) => THREE.MathUtils.lerp(a, b, t);

    // ── Phase 1: Idle float (0.0 - 0.15) ──
    const idleFloat = Math.sin(time * 0.5) * 2;
    if (group.current && r < 0.15) {
      group.current.position.y = lerp(0, idleFloat, 1 - r / 0.15);
    }

    // ── Phase 2: Shell Separation (0.15 - 0.35) ──
    const shellProgress = Math.max(0, Math.min((r - 0.15) * 5, 1));
    if (shellRightRef.current) {
      shellRightRef.current.position.x = lerp(-87.5, -140, shellProgress);
      shellRightRef.current.position.y = lerp(0, 20, shellProgress);
      shellRightRef.current.rotation.z = lerp(0, -0.1, shellProgress);
    }
    if (shellLeftRef.current) {
      shellLeftRef.current.position.x = lerp(0, 60, shellProgress);
      shellLeftRef.current.position.y = lerp(0, 20, shellProgress);
      shellLeftRef.current.rotation.z = lerp(0, 0.1, shellProgress);
    }
    if (shellCenterRef.current) {
      shellCenterRef.current.position.y = lerp(0, -10, shellProgress);
    }

    // ── Phase 3: Mechanisms Float Up (0.30 - 0.55) ──
    const mechProgress = Math.max(0, Math.min((r - 0.3) * 4, 1));
    if (buttonsRef.current) {
      buttonsRef.current.position.y = lerp(0, 80, mechProgress);
      buttonsRef.current.position.z = lerp(31.25, 60, mechProgress);
    }
    if (dpadRef.current) {
      dpadRef.current.position.y = lerp(9.375, 70, mechProgress);
      dpadRef.current.position.z = lerp(-25, 10, mechProgress);
    }
    if (sticksRef.current) {
      sticksRef.current.position.y = lerp(0, 50, mechProgress);
    }
    if (triggersRef.current) {
      triggersRef.current.position.y = lerp(0, 65, mechProgress);
      triggersRef.current.rotation.x = lerp(0.175, 0.5, mechProgress);
    }
    if (centerButtonsRef.current) {
      centerButtonsRef.current.position.y = lerp(0, 55, mechProgress);
    }

    // ── Phase 4: Core Reveal (0.50 - 0.75) ──
    const coreProgress = Math.max(0, Math.min((r - 0.5) * 4, 1));
    if (coreRef.current) {
      coreRef.current.scale.setScalar(lerp(0, 1, coreProgress));
      coreRef.current.rotation.y = time * 0.3;
      coreRef.current.rotation.x = time * 0.1;
    }

    // ── Phase 5: Platform Rings Orbit (0.65 - 1.0) ──
    const ringProgress = Math.max(0, Math.min((r - 0.65) * 2.86, 1));
    if (ringsRef.current) {
      ringsRef.current.scale.setScalar(lerp(0.5, 1, ringProgress));
      ringsRef.current.rotation.x = lerp(0, Math.PI / 2, ringProgress);
      ringsRef.current.rotation.y = time * 0.2;
    }

    // ── Emissive Intensity Ramp (0.60 - 1.0) ──
    const glowProgress = Math.max(0, Math.min((r - 0.6) * 2.5, 1));
    psBlue.emissiveIntensity = lerp(0, 1.5, glowProgress);
    xboxGreen.emissiveIntensity = lerp(0, 1.5, glowProgress);
    steamGrey.emissiveIntensity = lerp(0, 1.5, glowProgress);
  });

  return (
    <group
      ref={group}
      {...props}
      dispose={null}
      rotation={[-Math.PI / 2, 0, Math.PI]}
      scale={0.907}
    >
      <group rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
        {/* ═══════════════════════════════════════
            SHELL — Dark Chrome Exterior
            These pieces drift apart to reveal inside
           ═══════════════════════════════════════ */}
        <group ref={shellRightRef} position={[-87.5, 0, 31.25]}>
          <mesh
            geometry={nodes.RightSideBase_Dualshock_Blue_0.geometry}
            material={darkChrome}
            castShadow
          />
        </group>

        <group ref={shellLeftRef} position={[0, 0, 31.25]}>
          <mesh
            geometry={nodes.LeftSideBase_Dualshock_Blue_0.geometry}
            material={darkChrome}
            castShadow
          />
        </group>

        <group ref={shellCenterRef} position={[0, 0, 6.25]}>
          <mesh
            geometry={nodes.CenterBase_Dualshock_Blue_0.geometry}
            material={darkChrome}
            castShadow
          />
        </group>

        {/* ═══════════════════════════════════════
            MECHANICAL PARTS — Gunmetal
            Buttons, sticks, triggers float upward
           ═══════════════════════════════════════ */}

        {/* Action Buttons — PlayStation Blue Glow */}
        <group ref={buttonsRef} position={[-87.5, 0, 31.25]}>
          <mesh geometry={nodes.Square_Dualshock_Blue_0.geometry} material={psBlue} />
          <mesh geometry={nodes.Triangle_Dualshock_Blue_0.geometry} material={psBlue} />
          <mesh geometry={nodes.Cross_Dualshock_Blue_0.geometry} material={psBlue} />
          <mesh geometry={nodes.Circle_Dualshock_Blue_0.geometry} material={psBlue} />
        </group>

        {/* D-Pad — Xbox Green Glow */}
        <group ref={dpadRef} position={[87.5, 9.375, -25]}>
          <mesh geometry={nodes.Up_Dualshock_Blue_0.geometry} material={xboxGreen} />
          <mesh geometry={nodes.Down_Dualshock_Blue_0.geometry} material={xboxGreen} />
          <mesh geometry={nodes.Right_Dualshock_Blue_0.geometry} material={xboxGreen} />
          <mesh geometry={nodes.Left_Dualshock_Blue_0.geometry} material={xboxGreen} />
        </group>

        {/* Analog Sticks — Neutral Gunmetal */}
        <group ref={sticksRef}>
          <group position={[-87.5, 0, 31.25]}>
            <mesh geometry={nodes.R3_Dualshock_Blue_0.geometry} material={gunmetal} />
            <mesh geometry={nodes.RightStickBase_Dualshock_Blue_0.geometry} material={gunmetal} />
          </group>
          <group position={[87.5, 0, 0]}>
            <mesh geometry={nodes.L3_Dualshock_Blue_0.geometry} material={gunmetal} />
            <mesh geometry={nodes.LeftStickBase_Dualshock_Blue_0.geometry} material={gunmetal} />
          </group>
        </group>

        {/* Triggers — Mixed Platform Glow */}
        <group ref={triggersRef}>
          <group position={[-87.5, 0, 31.25]}>
            <group position={[87.5, 0, -25]}>
              <mesh geometry={nodes.R1_Dualshock_Blue_0.geometry} material={psBlue} />
            </group>
            <group position={[0, -31.25, 43.75]} rotation={[0.175, 0, 0]}>
              <mesh geometry={nodes.R2_Dualshock_Blue_0.geometry} material={psBlue} />
            </group>
          </group>
          <group position={[87.5, 0, 0]}>
            <group position={[-87.5, 0, -25]}>
              <mesh geometry={nodes.L1_Dualshock_Blue_0.geometry} material={xboxGreen} />
            </group>
            <group position={[0, -31.25, 43.75]} rotation={[0.175, 0, 0]}>
              <mesh geometry={nodes.L2_Dualshock_Blue_0.geometry} material={xboxGreen} />
            </group>
          </group>
        </group>

        {/* Center Buttons — Steam Grey Glow */}
        <group ref={centerButtonsRef} position={[0, 0, 6.25]}>
          <mesh geometry={nodes.Select_Dualshock_Blue_0.geometry} material={steamGrey} />
          <mesh geometry={nodes.Start_Dualshock_Blue_0.geometry} material={steamGrey} />
          <mesh geometry={nodes.Analog_Dualshock_Blue_0.geometry} material={steamGrey} />
        </group>

        {/* ═══════════════════════════════════════
            THE CORE — Warm Amber Heart
            Appears when shell opens
           ═══════════════════════════════════════ */}
        <group ref={coreRef} position={[0, 0, 20]} scale={0}>
          {/* Main glowing body */}
          <mesh>
            <icosahedronGeometry args={[25, 2]} />
            <meshStandardMaterial {...coreMaterial} wireframe />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[15, 1]} />
            <meshStandardMaterial {...coreMaterial} />
          </mesh>

          {/* Inner light */}
          <pointLight color="#ff4400" intensity={50} distance={100} />
        </group>

        {/* ═══════════════════════════════════════
            PLATFORM RINGS — Orbit the core
            Represent unified platforms
           ═══════════════════════════════════════ */}
        <group ref={ringsRef} position={[0, 0, 20]} scale={0}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            {/* PlayStation Ring */}
            <mesh rotation={[0, 0, 0]}>
              <torusGeometry args={[55, 1.5, 16, 100]} />
              <meshStandardMaterial {...ringBlueMat} />
            </mesh>
            {/* Xbox Ring */}
            <mesh rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[62, 1.5, 16, 100]} />
              <meshStandardMaterial {...ringGreenMat} />
            </mesh>
            {/* Steam Ring */}
            <mesh rotation={[Math.PI / 6, 0, 0]}>
              <torusGeometry args={[69, 1.5, 16, 100]} />
              <meshStandardMaterial {...ringSteamMat} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload('/scene.gltf');
