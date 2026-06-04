/**
 * Which input context is active.
 *
 *   driving — WASD controls the car, arcade controls are ignored
 *   arcade  — car receives all-false controls (coasts to stop),
 *             arrow keys navigate the arcade screen
 */
export type InputMode = 'driving' | 'arcade';

/**
 * Controls read by useCarPhysics every frame.
 * Identical shape to the existing KeyboardControls — no physics changes needed.
 */
export interface CarControls {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly brake: boolean;
}

/**
 * Controls read by ArcadeScreen for game navigation.
 */
export interface ArcadeControls {
  /** ArrowLeft — go to previous game */
  readonly prev: boolean;
  /** ArrowRight — go to next game */
  readonly next: boolean;
  /** Escape — close the arcade screen (same effect as the ✕ button) */
  readonly close: boolean;
  /** Enter — confirm / select (reserved for future use) */
  readonly select: boolean;
}

/** Null object used when arcade mode is inactive — all keys false */
export const INERT_CAR_CONTROLS: Readonly<CarControls> = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  brake: false,
} as const;

/** Null object used when driving mode is active — all arcade keys false */
export const INERT_ARCADE_CONTROLS: Readonly<ArcadeControls> = {
  prev: false,
  next: false,
  close: false,
  select: false,
} as const;
