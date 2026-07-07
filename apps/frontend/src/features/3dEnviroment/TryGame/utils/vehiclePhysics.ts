// utils/vehiclePhysics.ts
/**
 * Pure physics functions — no Three.js, no React, no side-effects.
 * Each function does exactly one thing (SRP) and is independently testable.
 *
 * Coordinate convention (matches positionCalculators):
 *   positive speed  → car moves in its LOCAL −Z direction (Three.js forward)
 *   rotation.y      → chassis yaw in world space
 */

import { PHYSICS_CONSTANTS } from '../types/vehicle';

import type { KeyboardControls, VehiclePhysicsConfig, VehicleState } from '../types/vehicle';

// ── Guards ────────────────────────────────────────────────────────────────

export const isValidDeltaTime = (dt: number): boolean =>
  dt > 0 && dt <= PHYSICS_CONSTANTS.MAX_DELTA_TIME;

export const isMoving = (speed: number): boolean =>
  Math.abs(speed) > PHYSICS_CONSTANTS.STEERING_DEACTIVATION_THRESHOLD;

// ── Speed helpers ─────────────────────────────────────────────────────────

/**
 * Exponential decay — feels natural for both friction and braking
 * because it's frame-rate independent.
 */
const exponentialDecay = (value: number, rate: number, dt: number): number =>
  value * Math.exp(-rate * dt);

/**
 * Acceleration tapers off as speed approaches maxSpeed, mimicking a
 * real torque curve. The sqrt gives a fast initial pull and a soft ceiling.
 *
 *   effective = base * sqrt(1 − |speed| / max)
 *
 * At speed=0    → full acceleration
 * At speed=max  → 0 (can't exceed top speed under power)
 */
const taperedAcceleration = (baseAccel: number, speed: number, maxSpeed: number): number => {
  const ratio = Math.abs(speed) / maxSpeed;
  return baseAccel * Math.sqrt(Math.max(0, 1 - ratio));
};

// ── Exported calculators ──────────────────────────────────────────────────

/**
 * Calculates the new speed after applying throttle, reverse, or coast friction.
 * Does NOT apply braking — that is a separate concern handled by applyBraking.
 */
export const calculateSpeedChange = (
  currentSpeed: number,
  controls: Readonly<KeyboardControls>,
  config: Readonly<VehiclePhysicsConfig>,
  dt: number,
): number => {
  if (!isValidDeltaTime(dt)) return currentSpeed;

  if (controls.forward) {
    const accel = taperedAcceleration(config.acceleration, currentSpeed, config.maxSpeed);
    return currentSpeed + accel * dt;
  }

  if (controls.backward) {
    const accel = taperedAcceleration(config.acceleration, currentSpeed, config.maxReverseSpeed);
    return currentSpeed - accel * dt;
  }

  // Coasting — exponential friction brings speed smoothly toward 0
  const decayed = exponentialDecay(currentSpeed, config.friction, dt);
  return Math.abs(decayed) < PHYSICS_CONSTANTS.SPEED_STOP_THRESHOLD ? 0 : decayed;
};

/**
 * Applies braking force (bound to Space / handbrake key).
 * Uses a stronger exponential decay than coast friction.
 */
export const applyBraking = (
  speed: number,
  config: Readonly<VehiclePhysicsConfig>,
  dt: number,
): number => {
  if (!isValidDeltaTime(dt)) return speed;

  const braked = exponentialDecay(speed, config.brakingForce, dt);
  return Math.abs(braked) < PHYSICS_CONSTANTS.SPEED_STOP_THRESHOLD ? 0 : braked;
};

/**
 * Hard clamps speed to [−maxReverseSpeed, +maxSpeed].
 * Called last, after all other speed mutations.
 */
export const clampSpeed = (speed: number, config: Readonly<VehiclePhysicsConfig>): number =>
  Math.max(-config.maxReverseSpeed, Math.min(speed, config.maxSpeed));

/**
 * Returns the raw steering angle (rad/s) based on input and current speed.
 *
 * Speed-dependent damping:
 *   effectiveTurn = turnSpeed / (1 + |speed| * damping)
 *
 * This makes the car nimble at low speed (kart feel) and progressively
 * harder to turn at high speed (prevents unrealistic pirouettes).
 */
export const calculateSteeringAngle = (
  speed: number,
  controls: Readonly<KeyboardControls>,
  config: Readonly<VehiclePhysicsConfig>,
): number => {
  if (!isMoving(speed)) return 0;

  const directionSign = speed > 0 ? 1 : -1;
  const speedDamping = 1 + Math.abs(speed) * config.steeringSpeedDamping;
  const effectiveTurn = config.turnSpeed / speedDamping;

  if (controls.left) return effectiveTurn * directionSign;
  if (controls.right) return -effectiveTurn * directionSign;
  return 0;
};

/**
 * Scrubs speed based on how hard the car is turning.
 *
 * Sharp corners naturally shed speed (lateral tyre friction).
 * The penalty is proportional to |steeringAngle| and current |speed|,
 * so it only matters at meaningful speeds and steering inputs.
 */
export const applyCorneringFriction = (
  speed: number,
  steeringAngle: number,
  config: Readonly<VehiclePhysicsConfig>,
  dt: number,
): number => {
  if (!isValidDeltaTime(dt)) return speed;

  const scrub = Math.abs(steeringAngle) * config.lateralFriction * dt;
  // exponentialDecay with the scrub rate, then preserve sign
  const reduced = Math.abs(speed) * Math.exp(-scrub);
  return speed >= 0 ? reduced : -reduced;
};

/**
 * Calculates how much the chassis heading should rotate toward the
 * current velocity direction this frame — the core of grip vs drift.
 *
 * When grip = 1.0 → chassis snaps instantly to velocity direction (no drift).
 * When grip = 0.0 → chassis is free to point anywhere (pure ice / drift).
 *
 * Returns a delta-rotation (radians) to ADD to currentRotation this frame.
 *
 * Formula derivation:
 *   The desired heading IS currentRotation + steeringAngle*dt.
 *   gripFactor lerps between "keep heading as-is" and "snap to desired",
 *   which effectively scales the steering contribution by grip.
 *
 * Implementation: we return the steering contribution already scaled,
 * so the caller simply does:  rotation += alignedSteering * dt
 */
export const calculateGrippedSteering = (
  steeringAngle: number,
  isHandbraking: boolean,
  config: Readonly<VehiclePhysicsConfig>,
): number => {
  const grip = isHandbraking ? config.driftGripFactor : config.gripFactor;
  // Scale the steering angle by grip — at full grip the full angle is applied,
  // at low grip only a fraction of it aligns the chassis with velocity.
  return steeringAngle * grip;
};

// ── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Single entry point used by useCarPhysics.
 * Runs all the steps in the correct order and returns the new VehicleState.
 *
 * Order matters:
 *   1. Throttle / coast  →  raw speed change
 *   2. Braking           →  overrides throttle if brake held
 *   3. Clamp             →  enforce speed limits
 *   4. Steering          →  depends on clamped speed
 *   5. Cornering scrub   →  speed penalty for turning
 *   6. Grip alignment    →  how much steering actually rotates chassis
 */
export const calculateNextVehicleState = (
  currentSpeed: number,
  controls: Readonly<KeyboardControls>,
  config: Readonly<VehiclePhysicsConfig>,
  dt: number,
): VehicleState => {
  // 1. Throttle / coast
  let speed = calculateSpeedChange(currentSpeed, controls, config, dt);

  // 2. Braking overrides throttle
  if (controls.brake) {
    speed = applyBraking(speed, config, dt);
  }

  // 3. Clamp to configured speed limits
  speed = clampSpeed(speed, config);

  // 4. Raw steering angle (speed-dependent)
  const rawSteering = calculateSteeringAngle(speed, controls, config);

  // 5. Cornering friction scrubs speed on hard turns
  speed = applyCorneringFriction(speed, rawSteering, config, dt);

  // 6. Grip scales how much of that steering actually rotates the chassis
  const steeringAngle = calculateGrippedSteering(rawSteering, controls.brake, config);

  return { speed, steeringAngle };
};
