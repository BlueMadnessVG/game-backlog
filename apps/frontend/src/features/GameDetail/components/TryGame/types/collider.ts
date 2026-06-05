/**
 * Independent collision volume — completely decoupled from visual representation.
 *
 * Why separate from BillboardConfig?
 * BillboardConfig drives visual layout (width/height for flat panels, or
 * is ignored entirely for GLTF models like the arcade cabinet).
 * ColliderConfig drives physics only. For flat panels the sizes happen to match;
 * for 3D GLTF objects the collision box must be authored independently.
 *
 * This makes it easy to add any future collidable object (wall, crate, pillar)
 * without it needing to be a billboard at all.
 */
export interface ColliderConfig {
  /** World-space centre of the collision box. */
  readonly position: readonly [number, number, number];
  /**
   * Euler rotation (XYZ, radians) of the collision box.
   * Must match the visual object's rotation so the box is aligned.
   */
  readonly rotation: readonly [number, number, number];
  /**
   * Half-extents along each local axis (width/2, height/2, depth/2).
   * Think of these as the 'radius' of the box in each direction.
   */
  readonly halfExtents: readonly [number, number, number];
  /**
   * How hard the car bounces on impact.
   *
   *   0.0 → car stops dead (soft foam wall)
   *   0.2 → gentle push-back (flat billboard panel)
   *   0.4 → noticeable bounce (solid arcade cabinet)
   *   0.8 → strong rebound (rubber barrier / pinball bumper)
   *   1.0 → full elastic reflection (theoretical)
   *
   * This value scales the post-collision speed: newSpeed = -currentSpeed * bounceFactor
   */
  readonly bounceFactor: number;
  /** Human-readable label used in debug helpers and warnings. */
  readonly label: string;
}
