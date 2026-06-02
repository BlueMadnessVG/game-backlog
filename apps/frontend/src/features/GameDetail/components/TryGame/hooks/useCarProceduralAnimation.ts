// hooks/useCarProceduralAnimation.ts
import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { KeyboardControls } from '../types/vehicle';

interface ProceduralAnimationRefs {
  readonly frontLeftWheelRef: React.RefObject<THREE.Group | null>;
  readonly frontRightWheelRef: React.RefObject<THREE.Group | null>;
  readonly rearLeftWheelRef: React.RefObject<THREE.Group | null>;
  readonly rearRightWheelRef: React.RefObject<THREE.Group | null>;
  readonly chassisIdleRef: React.RefObject<THREE.Group | null>;
  readonly chassisMotionRef: React.RefObject<THREE.Group | null>;
}

/**
 * SRP: Procedurally calculates and drives wheel spinning, steering articulation,
 * and body suspension bobbing purely via code transformations every frame.
 */
export function useCarProceduralAnimation(
  refs: ProceduralAnimationRefs,
  sharedSpeedRef: React.MutableRefObject<number>,
  controlsRef: React.RefObject<KeyboardControls>,
): void {
  const wheelRotationAngleRef = useRef<number>(0);

  useFrame((state, delta) => {
    const {
      frontLeftWheelRef,
      frontRightWheelRef,
      rearLeftWheelRef,
      rearRightWheelRef,
      chassisIdleRef,
      chassisMotionRef,
    } = refs;
    const currentSpeed = sharedSpeedRef.current;
    const controls = controlsRef.current;
    if (!controls) return;

    const elapsedTime = state.clock.getElapsedTime();

    // ── 1. WHEEL SPIN ANIMATION ──────────────────────────────────────────
    const wheelRadiusFactor = 0.55;
    const angularVelocity = currentSpeed / wheelRadiusFactor;
    wheelRotationAngleRef.current += angularVelocity * delta;
    const currentSpin = wheelRotationAngleRef.current;

    if (frontLeftWheelRef.current) frontLeftWheelRef.current.rotation.z = -currentSpin;
    if (frontRightWheelRef.current) frontRightWheelRef.current.rotation.z = currentSpin;
    if (rearLeftWheelRef.current) rearLeftWheelRef.current.rotation.z = -currentSpin;
    if (rearRightWheelRef.current) rearRightWheelRef.current.rotation.z = currentSpin;

    // ── 2. STEERING ARTICULATION (WITH FR INVERSION) ─────────────────────
    let targetSteerAngle = 0;
    const maxSteerVisualAngle = 0.45;

    if (controls.left) targetSteerAngle = maxSteerVisualAngle;
    if (controls.right) targetSteerAngle = -maxSteerVisualAngle;

    if (frontLeftWheelRef.current) {
      frontLeftWheelRef.current.rotation.y = THREE.MathUtils.lerp(
        frontLeftWheelRef.current.rotation.y,
        targetSteerAngle,
        15 * delta,
      );
    }
    if (frontRightWheelRef.current) {
      frontRightWheelRef.current.rotation.y = THREE.MathUtils.lerp(
        frontRightWheelRef.current.rotation.y,
        -targetSteerAngle,
        15 * delta,
      );
    }

    // ── 3. LAYERED BODY ANIMATIONS (CONSERVED IDLE + MOTION) ──────────────
    if (chassisIdleRef.current) {
      const idleFrequency = 2.5;
      const idleAmplitude = 0.005;
      chassisIdleRef.current.position.y = Math.sin(elapsedTime * idleFrequency) * idleAmplitude;
    }

    // Layer B: Dynamic Motion / Suspension Bobbing (Only active when moving)
    if (chassisMotionRef.current) {
      if (Math.abs(currentSpeed) > 0.1) {
        const motionFrequency = 14;
        const motionAmplitude = 0.015;
        chassisMotionRef.current.position.y =
          Math.sin(elapsedTime * motionFrequency) * motionAmplitude;
      } else {
        // Smoothly return suspension to baseline when completely stopped
        chassisMotionRef.current.position.y = THREE.MathUtils.lerp(
          chassisMotionRef.current.position.y,
          0,
          10 * delta,
        );
      }
    }
  });
}
