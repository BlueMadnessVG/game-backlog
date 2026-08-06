// cspell:words GLTF gltf drei Valorant lerp Sketchfab Dualshock
import { useRef } from 'react';

import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { EdgesMesh } from './EdgesMesh';
import GlowGroup from './GlowGroup';
import PlatformHologram from './PlatformHologram';
import updateButton from './utils/DestructuredController.utils';
import { useButtonHotspotsStore } from '../../store/heroButtonHotspots.Store';
import { useScrollStore } from '../../store/heroPageScroll.Store';
import { PS_BLUE, XBOX_GREEN, STEAM_GREY, UNIFIED_AMBER } from '../../utils/platformColors';
import { DOCK_COMPLETE, PLATFORM_TIMELINE } from '../../utils/scrollTimeline';

import type { Mesh } from 'three';

const lerp = THREE.MathUtils.lerp;

export function DeconstructedController() {
  const group = useRef<THREE.Group>(null);
  const { nodes: rawNodes, animations } = useGLTF('/models/controller/scene.gltf');
  useAnimations(animations, group);
  const nodes = rawNodes as Record<string, Mesh>;

  const entryProgress = useRef(0);
  const hasEntered = useRef(false);

  const squareActive = useRef(0);
  const triangleActive = useRef(0);
  const crossActive = useRef(0);
  const circleActive = useRef(0);

  const squareGlow = useRef(false);
  const triangleGlow = useRef(false);
  const crossGlow = useRef(false);
  const circleGlow = useRef(false);

  const squareDepressRef = useRef<THREE.Group>(null);
  const triangleDepressRef = useRef<THREE.Group>(null);
  const crossDepressRef = useRef<THREE.Group>(null);
  const circleDepressRef = useRef<THREE.Group>(null);

  const squareBeamRef = useRef<THREE.Mesh>(null);
  const triangleBeamRef = useRef<THREE.Mesh>(null);
  const crossBeamRef = useRef<THREE.Mesh>(null);
  const circleBeamRef = useRef<THREE.Mesh>(null);

  const squareBleedRef = useRef<THREE.Mesh>(null);
  const triangleBleedRef = useRef<THREE.Mesh>(null);
  const crossBleedRef = useRef<THREE.Mesh>(null);
  const circleBleedRef = useRef<THREE.Mesh>(null);

  const updateEntry = (delta: number) => {
    if (hasEntered.current) return;

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
  };

  const updateScrollRotation = () => {
    if (!group.current || !hasEntered.current) return;

    const r = useScrollStore.getState().progress;
    const rotProgress = Math.min(r / DOCK_COMPLETE, 1);

    group.current.rotation.x = lerp(0, -0.55, rotProgress);
    group.current.position.z = lerp(0, 2.59, rotProgress);
    group.current.position.y = lerp(0, -0.55, rotProgress);

    if (r > 0.3 && r < 0.98) {
      const [steamStart, steamEnd] = PLATFORM_TIMELINE.steam;
      const [xboxStart, xboxEnd] = PLATFORM_TIMELINE.xbox;
      const [psStart, psEnd] = PLATFORM_TIMELINE.playstation;
      const [unifiedStart] = PLATFORM_TIMELINE.unified;

      crossActive.current = r > steamStart && r <= steamEnd ? 1 : 0;
      triangleActive.current = r > xboxStart && r <= xboxEnd ? 1 : 0;
      squareActive.current = r > psStart && r <= psEnd ? 1 : 0;
      circleActive.current = r > unifiedStart ? 1 : 0;
    } else {
      crossActive.current = 0;
      triangleActive.current = 0;
      squareActive.current = 0;
      circleActive.current = 0;
    }
  };

  useFrame((_state, delta) => {
    updateEntry(delta);
    updateScrollRotation();

    const { glow } = useButtonHotspotsStore.getState();
    squareGlow.current = glow.square;
    triangleGlow.current = glow.triangle;
    crossGlow.current = glow.cross;
    circleGlow.current = glow.circle;

    updateButton(squareDepressRef, squareBeamRef, squareBleedRef, squareGlow);
    updateButton(triangleDepressRef, triangleBeamRef, triangleBleedRef, triangleGlow);
    updateButton(crossDepressRef, crossBeamRef, crossBleedRef, crossGlow);
    updateButton(circleDepressRef, circleBeamRef, circleBleedRef, circleGlow);
  });

  return (
    <group ref={group} dispose={null}>
      <group name="Sketchfab_Scene">
        <group name="Sketchfab_model" rotation={[12, 0, Math.PI]} scale={0.907}>
          <group
            name="02b8b04a84f444f58559ae046d9e9522fbx"
            rotation={[Math.PI / 2, 0, 0]}
            scale={0.01}
          >
            <group name="Object_2">
              <group name="RootNode">
                <group name="Dualshock" position={[0, 0, 6.25]}>
                  <group name="RightSide" position={[-87.5, 0, 31.25]}>
                    <group name="RightSideBase">
                      <EdgesMesh
                        geometry={nodes.RightSideBase_Dualshock_Blue_0.geometry}
                        color="#444444"
                        threshold={15}
                      />
                    </group>

                    <group name="Buttons">
                      <GlowGroup name="Square" activeRef={squareGlow}>
                        <mesh ref={squareBleedRef} position={[0, -2, 0]} scale={0}>
                          <cylinderGeometry args={[4, 6, 1, 6]} />
                          <meshBasicMaterial
                            color={PS_BLUE}
                            transparent
                            opacity={0.4}
                            toneMapped={false}
                          />
                        </mesh>

                        <group name="Hotspot-Square" ref={squareDepressRef}>
                          <EdgesMesh
                            geometry={nodes.Square_Dualshock_Blue_0.geometry}
                            color={PS_BLUE}
                            threshold={15}
                            activeRef={squareGlow}
                            glowIntensity={4}
                          />
                        </group>

                        <mesh ref={squareBeamRef} position={[0, 15, 0]} scale={[1, 0, 1]}>
                          <boxGeometry args={[0.3, 30, 0.3]} />
                          <meshBasicMaterial
                            color={PS_BLUE}
                            transparent
                            opacity={0.6}
                            toneMapped={false}
                          />
                        </mesh>

                        <PlatformHologram
                          position={[0, 85, 0]}
                          color={PS_BLUE}
                          activeRef={squareActive}
                        />
                      </GlowGroup>

                      <GlowGroup name="Triangle" activeRef={triangleGlow}>
                        <mesh ref={triangleBleedRef} position={[0, -2, 0]} scale={0}>
                          <cylinderGeometry args={[4, 6, 1, 6]} />
                          <meshBasicMaterial
                            color={XBOX_GREEN}
                            transparent
                            opacity={0.4}
                            toneMapped={false}
                          />
                        </mesh>

                        <group name="Hotspot-Triangle" ref={triangleDepressRef}>
                          <EdgesMesh
                            geometry={nodes.Triangle_Dualshock_Blue_0.geometry}
                            color={XBOX_GREEN}
                            threshold={15}
                            activeRef={triangleGlow}
                            glowIntensity={4}
                          />
                        </group>

                        <mesh ref={triangleBeamRef} position={[0, 15, 0]} scale={[1, 0, 1]}>
                          <boxGeometry args={[0.3, 30, 0.3]} />
                          <meshBasicMaterial
                            color={XBOX_GREEN}
                            transparent
                            opacity={0.6}
                            toneMapped={false}
                          />
                        </mesh>

                        <PlatformHologram
                          position={[0, 85, 0]}
                          color={XBOX_GREEN}
                          activeRef={triangleActive}
                        />
                      </GlowGroup>

                      <GlowGroup name="Cross" activeRef={crossGlow}>
                        <mesh ref={crossBleedRef} position={[0, -2, 0]} scale={0}>
                          <cylinderGeometry args={[4, 6, 1, 6]} />
                          <meshBasicMaterial
                            color={STEAM_GREY}
                            transparent
                            opacity={0.4}
                            toneMapped={false}
                          />
                        </mesh>

                        <group name="Hotspot-Cross" ref={crossDepressRef}>
                          <EdgesMesh
                            geometry={nodes.Cross_Dualshock_Blue_0.geometry}
                            color={STEAM_GREY}
                            threshold={15}
                            activeRef={crossGlow}
                            glowIntensity={4}
                          />
                        </group>

                        <mesh ref={crossBeamRef} position={[0, 15, 0]} scale={[1, 0, 1]}>
                          <boxGeometry args={[0.3, 30, 0.3]} />
                          <meshBasicMaterial
                            color={STEAM_GREY}
                            transparent
                            opacity={0.6}
                            toneMapped={false}
                          />
                        </mesh>

                        <PlatformHologram
                          position={[0, 85, 0]}
                          color={STEAM_GREY}
                          activeRef={crossActive}
                        />
                      </GlowGroup>

                      <GlowGroup name="Circle" activeRef={circleGlow}>
                        <mesh ref={circleBleedRef} position={[0, -2, 0]} scale={0}>
                          <cylinderGeometry args={[4, 6, 1, 6]} />
                          <meshBasicMaterial
                            color={UNIFIED_AMBER}
                            transparent
                            opacity={0.4}
                            toneMapped={false}
                          />
                        </mesh>

                        <group name="Hotspot-Circle" ref={circleDepressRef}>
                          <EdgesMesh
                            geometry={nodes.Circle_Dualshock_Blue_0.geometry}
                            color={UNIFIED_AMBER}
                            threshold={15}
                            activeRef={circleGlow}
                            glowIntensity={4}
                          />
                        </group>

                        <mesh ref={circleBeamRef} position={[0, 15, 0]} scale={[1, 0, 1]}>
                          <boxGeometry args={[0.3, 30, 0.3]} />
                          <meshBasicMaterial
                            color={UNIFIED_AMBER}
                            transparent
                            opacity={0.6}
                            toneMapped={false}
                          />
                        </mesh>

                        <PlatformHologram
                          position={[0, 85, 0]}
                          color={UNIFIED_AMBER}
                          activeRef={circleActive}
                        />
                      </GlowGroup>
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
