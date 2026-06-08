/**
 * Static collision volumes for all billboard structures.
 *
 * These are INDEPENDENT of BillboardConfig (visual layout).
 * For flat panels the sizes roughly match; for the arcade cabinet
 * they represent the physical 3D footprint of the GLTF model.
 *
 * ── How to add a new collidable structure ─────────────────────────────────
 * 1. Add a ColliderConfig entry here with the correct halfExtents and
 *    bounceFactor for the new object.
 * 2. Pass the updated COLLIDER_CONFIGS array to Car via Stage.tsx.
 * No changes to useCarPhysics or collisionDetection are needed.
 *
 * ── Tuning halfExtents ────────────────────────────────────────────────────
 * halfExtents = [width/2, height/2, depth/2] in the object's local space.
 * Enable CollisionBoxHelper in the component to visualise the box in-scene.
 *
 * ── bounceFactor guide ────────────────────────────────────────────────────
 *   0.05 → barely any bounce (foam padding)
 *   0.15 → soft push-back (flat billboard panel — light frame)
 *   0.4  → noticeable rebound (solid arcade cabinet — metal body)
 *   0.7  → strong bounce (concrete pillar)
 *   1.0  → full elastic reflection (theoretical maximum)
 */

import type { ColliderConfig } from '../../../../types/collider';

export const BILLBOARD_COLLIDERS: readonly ColliderConfig[] = [
  // ── "Playing" — Arcade cabinet ──────────────────────────────────────────
  // Physical footprint of the GLTF model at CABINET_SCALE = 0.5.
  // Main group model-space: scale [3.429, 6.438, 3.499] × 0.5
  //   width  ≈ 3.429 × 0.5 = 1.71  → halfExtent x = 0.85
  //   height ≈ 6.438 × 0.5 = 3.22  → halfExtent y = 1.61 (raised by yOffset)
  //   depth  ≈ 3.499 × 0.5 = 1.75  → halfExtent z = 0.87
  // The cabinet base is at y=0, so centre y = halfExtent y = 1.61
  {
    position: [-20, 1.61, -15],
    rotation: [0, -Math.PI / 8, 0],
    halfExtents: [0.85, 1.61, 0.87],
    bounceFactor: 0.4,
    label: 'arcade-cabinet-playing',
  },

  // ── "Completed" — Flat panel billboard ──────────────────────────────────
  // width=8, height=6, frameThickness=0.15, frameDepth=0.1
  // halfExtents: [(8+0.3)/2, (6+0.3)/2, 0.1/2] = [4.15, 3.15, 0.05]
  // Panel centre is at y=3 (position.y from BillboardConfig)
  {
    position: [20, 1.2, -15], // matches BillboardConfig position for 'completed'
    rotation: [0, Math.PI / 8, 0],
    halfExtents: [1.1, 1.2, 0.7], // tune after seeing the model in-scene
    bounceFactor: 0.3, // solid wood — medium bounce
    label: 'trophy-case-completed',
  },

  // ── "Backlog" — Flat panel billboard ────────────────────────────────────
  {
    position: [0, 3, 30],
    rotation: [0, 0, 0],
    halfExtents: [4.15, 3.15, 0.05],
    bounceFactor: 0.15,
    label: 'flat-billboard-backlog',
  },
];
