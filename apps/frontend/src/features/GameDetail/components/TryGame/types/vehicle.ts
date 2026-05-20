export interface KeyboardControls {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly brake: boolean;
}

export interface VehiclePhysicsConfig {
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly friction: number;
  readonly turnSpeed: number;
  readonly brakingForce: number;
}

export interface VehicleState {
  readonly speed: number;
  readonly steeringAngle: number;
}

export const PHYSICS_CONSTANTS = {
  SPEED_STOP_THRESHOLD: 0.1,
  REVERSE_SPEED_RATIO: 0.5,
  MAX_DELTA_TIME: 0.1,
  STEERING_DEACTIVATION_THRESHOLD: 0.1,
} as const;

export const DEFAULT_PHYSICS_CONFIG: Readonly<VehiclePhysicsConfig> = {
  maxSpeed: 25,
  acceleration: 15,
  friction: 1.5,
  turnSpeed: 2.2,
  brakingForce: 5.0,
} as const;
