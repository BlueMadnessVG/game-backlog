/**
 * Pure gaze helpers used by the assistant rig.
 *
 * Exports:
 *  - sideOf: which side of the screen an NDC x is on.
 *  - lookTarget: the look vector from the cube toward an aim point.
 */
/** Gaze gain on the cube→aim vector (NDC), before clamping to -1..1. */
const LOOK_GAIN = 1;
/** |NDC x| below this counts as the centre when detecting a left/right switch. */
const SIDE_DEADZONE = 0.15;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Screen side for an NDC x: -1 left, 0 centre (inside the dead-zone), 1 right. */
export function sideOf(x: number): -1 | 0 | 1 {
  if (x > SIDE_DEADZONE) return 1;
  if (x < -SIDE_DEADZONE) return -1;
  return 0;
}

/**
 * Target gaze (-1..1 per axis), measured from the cube's own screen position
 * (NDC): toward `aim` (the pointer) or, with no aim, toward the screen centre.
 */
export function lookTarget(
  aim: { x: number; y: number } | null,
  cube: { x: number; y: number },
): { x: number; y: number } {
  const ax = aim ? aim.x : 0;
  const ay = aim ? aim.y : 0;
  return {
    x: clamp((ax - cube.x) * LOOK_GAIN, -1, 1),
    y: clamp((ay - cube.y) * LOOK_GAIN, -1, 1),
  };
}
