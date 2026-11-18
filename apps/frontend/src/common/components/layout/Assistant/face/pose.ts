/**
 * Mutable pose shared between the assistant rig (writes, once per frame) and
 * the cube and face (read, once per frame). Module-level on purpose: they all
 * live in the R3F reconciler and none should re-render when these change.
 *
 * Page-specific values (e.g. the hero's per-platform activation) live with
 * that page, not here.
 *
 * Exports:
 *  - pose: spread (0 closed … 1 fully open), the smoothed look vector (-1..1
 *    on each axis) and the eye reactions: `wide` (fast mouse, 0..1), `squint`
 *    (cursor on the cube, 0..1) and `blinkSeq` (each increment asks the face
 *    for one blink).
 *  - EyeReactions: the type of `pose.eyes`.
 */
export const pose = {
  spread: 0,
  look: { x: 0, y: 0 },
  eyes: { wide: 0, squint: 0, blinkSeq: 0 },
};

export type EyeReactions = typeof pose.eyes;
