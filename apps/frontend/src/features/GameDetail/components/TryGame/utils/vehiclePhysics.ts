import {
  applyBraking,
  calculateSpeedChange,
  calculateSteeringAngle,
  clampSpeed,
} from './physicsCalculators';
import { PHYSICS_CONSTANTS } from '../types/vehicle';

import type { KeyboardControls, VehiclePhysicsConfig, VehicleState } from '../types/vehicle';

export const calculateNextVehicleState = (
  currentSpeed: number,
  controls: Readonly<KeyboardControls>,
  config: Readonly<VehiclePhysicsConfig>,
  deltaTime: number,
): VehicleState => {
  const safeDelta = Math.min(deltaTime, PHYSICS_CONSTANTS.MAX_DELTA_TIME);

  let speed = calculateSpeedChange(currentSpeed, controls, config, safeDelta);

  if (controls.brake) {
    speed = applyBraking(speed, config, safeDelta);
  }

  speed = clampSpeed(speed, config);
  const steeringAngle = calculateSteeringAngle(speed, controls, config);

  return { speed, steeringAngle };
};
