import type { PlatformKey } from '../../utils/platformColors';

/**
 * Mutable pose shared between AssistantRig (writes, once per frame) and
 * AssistantCube (reads, once per frame). Module-level on purpose: both live in
 * the R3F reconciler and neither should re-render when these values change.
 *
 * Exports:
 *  - pose: spread (0 closed … 1 fully exploded), per-platform activation
 *    (0..1) and the smoothed pointer look vector (-1..1 on each axis).
 */
export const pose = {
  spread: 0,
  active: {
    steam: { current: 0 },
    xbox: { current: 0 },
    playstation: { current: 0 },
    unified: { current: 0 },
  } satisfies Record<PlatformKey, { current: number }>,
  look: { x: 0, y: 0 },
};
