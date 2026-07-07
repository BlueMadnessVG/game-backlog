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
 * Baked rest-pose rotation.z values for each wheel group.
 *
 * The GLTF wheel groups carry a camber/tilt baked into rotation.z as part
 * of the model's rest pose.  If we set rotation.z = spinAngle directly we
 * overwrite that tilt every frame, making the wheels look flat.
 *
 * Fix: always compose  rotation.z = BAKED_TILT + spinContribution
 * so the tilt is preserved while spin accumulates on top.
 *
 * Right-side wheels also have rotation.x = PI (they are mirrored), which
 * inverts the effective spin direction — hence the sign flip in the formulas
 * below matches what the left-side wheels already do with −currentSpin.
 */
const WHEEL_BAKED_TILT = {
  frontLeft: -1.403, // Front_wheel    rotation.z
  rearLeft: -2.159, // Rear_wheel     rotation.z
  frontRight: +1.308, // Front_wheel001 rotation.z  (mirrored)
  rearRight: +2.127, // Rear_wheel001  rotation.z  (mirrored)
} as const;

const WHEEL_RADIUS = 0.55; // world-units (rear wheel ≈ 55 model-units × 0.01 scale)
const MAX_STEER_ANGLE = 0.45; // radians — maximum visual front-wheel yaw
const STEER_LERP_SPEED = 15; // how quickly wheels snap to target steer angle

const IDLE_FREQUENCY = 2.5; // Hz  — gentle engine-idle float
const IDLE_AMPLITUDE = 0.005; // world-units vertical travel
const MOTION_FREQUENCY = 14; // Hz  — road-surface suspension chatter
const MOTION_AMPLITUDE = 0.015; // world-units vertical travel
const MOTION_THRESHOLD = 0.1; // |speed| below which motion layer fades out
const MOTION_RETURN_LERP = 10; // lerp speed back to baseline when stopped

/**
 * SRP: drives all procedural visual transformations each frame.
 *
 * Responsibilities:
 *   1. Wheel spin  — scaled to live speed, tilt preserved
 *   2. Front-wheel steer articulation — lerped to input
 *   3. Chassis idle float — constant low-frequency bob
 *   4. Chassis motion suspension — high-frequency chatter when moving
 *
 * This hook is intentionally separate from the GLTF clip playback in
 * useCarAnimation — the clip drives smoke/suspension bone animation while
 * this hook drives speed-dependent and input-dependent transforms.
 */
export function useCarProceduralAnimation(
  refs: ProceduralAnimationRefs,
  sharedSpeedRef: React.MutableRefObject<number>,
  controlsRef: React.RefObject<KeyboardControls>,
): void {
  const spinAccumulatorRef = useRef<number>(0);

  useFrame((state, delta) => {
    const {
      frontLeftWheelRef,
      frontRightWheelRef,
      rearLeftWheelRef,
      rearRightWheelRef,
      chassisIdleRef,
      chassisMotionRef,
    } = refs;

    const speed = sharedSpeedRef.current;
    const controls = controlsRef.current;
    if (!controls) return;

    const elapsed = state.clock.getElapsedTime();
    const safeDelta = Math.min(delta, 0.1);

    // ── 1. WHEEL SPIN ──────────────────────────────────────────────────────
    // Accumulate the angular displacement this frame.
    // angular velocity (rad/s) = linear speed / wheel radius
    spinAccumulatorRef.current += (speed / WHEEL_RADIUS) * safeDelta;
    const spin = spinAccumulatorRef.current;

    // Left wheels spin in the negative direction; right wheels (mirrored via
    // rotation.x=PI) spin positive — both produce forward rolling visually.
    // Always ADD the baked tilt so the camber is never lost.
    if (frontLeftWheelRef.current) {
      frontLeftWheelRef.current.rotation.z = WHEEL_BAKED_TILT.frontLeft - spin;
    }
    if (rearLeftWheelRef.current) {
      rearLeftWheelRef.current.rotation.z = WHEEL_BAKED_TILT.rearLeft - spin;
    }
    if (frontRightWheelRef.current) {
      frontRightWheelRef.current.rotation.z = WHEEL_BAKED_TILT.frontRight + spin;
    }
    if (rearRightWheelRef.current) {
      rearRightWheelRef.current.rotation.z = WHEEL_BAKED_TILT.rearRight + spin;
    }

    // ── 2. FRONT-WHEEL STEER ARTICULATION ─────────────────────────────────
    // Target angle from input; lerped so the wheels don't snap instantly.
    const targetSteer = controls.left ? MAX_STEER_ANGLE : controls.right ? -MAX_STEER_ANGLE : 0;

    const steerLerp = STEER_LERP_SPEED * safeDelta;

    if (frontLeftWheelRef.current) {
      frontLeftWheelRef.current.rotation.y = THREE.MathUtils.lerp(
        frontLeftWheelRef.current.rotation.y,
        targetSteer,
        steerLerp,
      );
    }
    if (frontRightWheelRef.current) {
      // Right wheel yaw is inverted (mirrored geometry)
      frontRightWheelRef.current.rotation.y = THREE.MathUtils.lerp(
        frontRightWheelRef.current.rotation.y,
        -targetSteer,
        steerLerp,
      );
    }

    // ── 3. CHASSIS IDLE FLOAT (always on) ─────────────────────────────────
    // Low-frequency engine-idle bob — independent of speed.
    // Lives on chassisIdleRef so it never interferes with the motion layer.
    if (chassisIdleRef.current) {
      chassisIdleRef.current.position.y = Math.sin(elapsed * IDLE_FREQUENCY) * IDLE_AMPLITUDE;
    }

    // ── 4. CHASSIS MOTION SUSPENSION (speed-gated) ────────────────────────
    // High-frequency road chatter — only active when the car is moving.
    // Fades back to zero when the car stops so it doesn't fight the idle bob.
    if (chassisMotionRef.current) {
      if (Math.abs(speed) > MOTION_THRESHOLD) {
        chassisMotionRef.current.position.y =
          Math.sin(elapsed * MOTION_FREQUENCY) * MOTION_AMPLITUDE;
      } else {
        chassisMotionRef.current.position.y = THREE.MathUtils.lerp(
          chassisMotionRef.current.position.y,
          0,
          MOTION_RETURN_LERP * safeDelta,
        );
      }
    }
  });
}
