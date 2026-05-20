import { PHYSICS_CONSTANTS } from '../types/vehicle';

import type { KeyboardControls, VehiclePhysicsConfig } from '../types/vehicle';

const isValidDeltaTime = (deltaTime: number): boolean => {
  return deltaTime > 0 && deltaTime <= PHYSICS_CONSTANTS.MAX_DELTA_TIME;
};

const isMoving = (speed: number): boolean => {
  return Math.abs(speed) > PHYSICS_CONSTANTS.STEERING_DEACTIVATION_THRESHOLD;
};

const applyExponentialDecay = (current: number, decayRate: number, deltaTime: number): number => {
  return current * Math.exp(-decayRate * deltaTime);
};

export const calculateSpeedChange = (
  currentSpeed: number,
  controls: Readonly<KeyboardControls>,
  config: Readonly<VehiclePhysicsConfig>,
  deltaTime: number,
): number => {
  if (!isValidDeltaTime(deltaTime)) return currentSpeed;

  let speed = currentSpeed;

  if (controls.forward) {
    speed += config.acceleration * deltaTime;
  } else if (controls.backward) {
    speed -= config.acceleration * deltaTime;
  } else {
    speed = applyExponentialDecay(speed, config.friction, deltaTime);
  }

  return speed;
};

export const applyBraking = (
  speed: number,
  config: Readonly<VehiclePhysicsConfig>,
  deltaTime: number,
): number => {
  if (!isValidDeltaTime(deltaTime)) return speed;

  const brakingSpeed = applyExponentialDecay(speed, config.brakingForce, deltaTime);
  const isStopped = Math.abs(brakingSpeed) < PHYSICS_CONSTANTS.SPEED_STOP_THRESHOLD;

  return isStopped ? 0 : brakingSpeed;
};

export const clampSpeed = (speed: number, config: Readonly<VehiclePhysicsConfig>): number => {
  const maxReverseSpeed = config.maxSpeed * PHYSICS_CONSTANTS.REVERSE_SPEED_RATIO;
  return Math.max(-maxReverseSpeed, Math.min(speed, config.maxSpeed));
};

export const calculateSteeringAngle = (
  speed: number,
  controls: Readonly<KeyboardControls>,
  config: Readonly<VehiclePhysicsConfig>,
): number => {
  if (!isMoving(speed)) return 0;

  const directionModifier = speed > 0 ? 1 : -1;
  let angle = 0;

  if (controls.left) angle = config.turnSpeed * directionModifier;
  if (controls.right) angle = -config.turnSpeed * directionModifier;

  return angle;
};
