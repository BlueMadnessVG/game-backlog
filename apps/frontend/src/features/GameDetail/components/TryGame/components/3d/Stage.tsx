// components/3d/Stage.tsx
/**
 * Scene root — creates all shared refs and wires them to child components.
 *
 * ── Input architecture ────────────────────────────────────────────────────
 *
 *   useCameraMode()  →  cameraModeRef   (read: CameraController)
 *                   ↘  cameraModeRef   (read: useInputRouter)
 *
 *   useInputRouter(cameraModeRef)
 *     → carControlsRef    passed to Car  → useCarPhysics
 *     → arcadeControlsRef passed to Billboards3D → ArcadeScreen
 *
 * The cameraModeRef doubles as the input-lock signal.  When the camera
 * is in 'arcade' mode, useInputRouter routes keyboard events to arcade
 * controls and returns all-false car controls so the car coasts to a stop.
 *
 * ── Data flow diagram ─────────────────────────────────────────────────────
 *
 *   Keyboard
 *     │
 *     ▼
 *   useInputRouter ──(cameraModeRef)──► mode check
 *     │                                  │
 *     ├─ carControlsRef ──────────────► Car (physics)
 *     └─ arcadeControlsRef ───────────► Billboards3D ──► ArcadeScreen
 *
 *   useCameraMode
 *     ├─ modeRef / poseRef ───────────► CameraController (zoom)
 *     ├─ openArcade() ────────────────► Billboards3D (E key)
 *     └─ closeArcade() ───────────────► Billboards3D (✕ button)
 */

import React, { useRef } from 'react';

import * as THREE from 'three';

import { Billboards3D } from './Billboard/3d/Billboards3D';
import { CameraController } from './CameraControlller';
import { Car } from './Car/Car';
import { useCameraMode } from '../../hooks/useCameraMode';
import { useInputRouter } from '../../hooks/useInputerRouter';
import { DEFAULT_PHYSICS_CONFIG } from '../../types/vehicle';

import type { VehiclePhysicsConfig } from '../../types/vehicle';

interface StageProps {
  readonly physicsConfig?: Readonly<VehiclePhysicsConfig>;
}

export const Stage: React.FC<StageProps> = ({ physicsConfig = DEFAULT_PHYSICS_CONFIG }) => {
  const carRootRef = useRef<THREE.Group>(null);
  const carSpeedRef = useRef<number>(0);

  // ── Camera state machine ──────────────────────────────────────────────
  const cameraMode = useCameraMode();

  // ── Input router ──────────────────────────────────────────────────────
  // cameraModeRef is passed so the router knows when to switch contexts.
  // When cameraMode.modeRef.current === 'arcade':
  //   carControlsRef   → all false  (car coasts to stop via friction)
  //   arcadeControlsRef → live arrow key state
  const { carControlsRef } = useInputRouter(cameraMode.modeRef);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />

      {/* Camera — needs modeRef+poseRef to drive zoom animation */}
      <CameraController
        targetRef={carRootRef}
        currentSpeedRef={carSpeedRef}
        modeControls={cameraMode}
      />

      {/* Car — receives carControlsRef which goes silent in arcade mode */}
      <Car
        sharedRootRef={carRootRef}
        sharedSpeedRef={carSpeedRef}
        billboardsConfig={[]}
        physicsConfig={physicsConfig}
        controlsRef={carControlsRef}
      />

      {/* Billboards — receives both camera controls (zoom) and arcade controls (navigation) */}
      <Billboards3D carPositionRef={carRootRef} cameraControls={cameraMode} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
    </>
  );
};
