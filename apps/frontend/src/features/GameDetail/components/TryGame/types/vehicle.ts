// ── Keyboard input ────────────────────────────────────────────────────────

export interface KeyboardControls {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  /** Handbrake — hold while turning to initiate drift */
  readonly brake: boolean;
}

// ── Physics config ────────────────────────────────────────────────────────

export interface VehiclePhysicsConfig {
  // ── Throttle & top speed
  readonly maxSpeed: number; // m/s forward
  readonly maxReverseSpeed: number; // m/s reverse (positive value)
  readonly acceleration: number; // m/s² base value (reduced near maxSpeed)

  // ── Deceleration
  readonly friction: number; // exponential decay rate when coasting
  readonly brakingForce: number; // exponential decay rate when braking

  // ── Steering
  readonly turnSpeed: number; // rad/s at low speed
  /**
   * How quickly turn radius widens with speed.
   * effectiveTurn = turnSpeed / (1 + |speed| * steeringSpeedDamping)
   * 0 = no damping (kart-like), 0.08 = realistic broadening
   */
  readonly steeringSpeedDamping: number;

  // ── Grip & drift
  /**
   * How strongly the car's heading snaps toward its velocity direction.
   * 1.0 = perfect grip (no drift), 0.0 = pure ice.
   * Forza-style: ~0.85. Mario Kart-style: ~0.70.
   */
  readonly gripFactor: number;
  /**
   * Grip factor when the handbrake is held (enables drift).
   * Should be lower than gripFactor. ~0.30 gives controllable slides.
   */
  readonly driftGripFactor: number;
  /**
   * Speed penalty per radian of steering input per second (cornering scrub).
   * 0 = no speed loss in corners, 0.4 = noticeable scrub.
   */
  readonly lateralFriction: number;
}

export interface VehicleState {
  readonly speed: number;
  readonly steeringAngle: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

export const PHYSICS_CONSTANTS = {
  /** Below this |speed| the car is considered fully stopped. */
  SPEED_STOP_THRESHOLD: 0.05,
  /** Below this |speed| steering is disabled (avoids spinning on the spot). */
  STEERING_DEACTIVATION_THRESHOLD: 0.1,
  /** delta is clamped to this to avoid tunnelling on lag spikes. */
  MAX_DELTA_TIME: 0.1,
  REVERSE_SPEED_RATIO: 0.5,
} as const;

/**
 * Default config — arcade feel, closer to Mario Kart than a sim.
 * Tweak gripFactor toward 1.0 for Forza-style, toward 0.6 for drift-heavy.
 */
export const DEFAULT_PHYSICS_CONFIG: Readonly<VehiclePhysicsConfig> = {
  maxSpeed: 22,
  maxReverseSpeed: 10,
  acceleration: 18,
  friction: 2.5,
  brakingForce: 8.0,
  turnSpeed: 2.4,
  steeringSpeedDamping: 0.07,
  gripFactor: 0.82,
  driftGripFactor: 0.28,
  lateralFriction: 0.35,
} as const;
