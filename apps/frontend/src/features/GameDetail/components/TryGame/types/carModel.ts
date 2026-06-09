// types/carModel.ts

export interface CarModelConfig {
  readonly url: string;
  readonly scale: number;
  readonly yOffset: number;
  /**
   * Extra Y rotation applied to the visual model so it aligns with
   * the physics chassis direction.
   *
   * Physics forward = local −Z (Three.js convention, rotation.y = 0).
   * The Drifter model was exported facing +X.
   *
   * R(−PI/2) around Y maps +X → −Z, so the visual front now matches
   * the physics forward direction.
   *
   * This fixes the bug where pressing W moved the car backwards:
   * previously PI/2 mapped +X → +Z, which is OPPOSITE to −Z forward.
   */
  readonly rotationYOffset: number;
}

export const DEFAULT_CAR_MODEL_CONFIG: Readonly<CarModelConfig> = {
  url: '/models/car/scene.gltf',
  scale: 0.01,
  yOffset: 0,
  rotationYOffset: -Math.PI / 2, // ← was +PI/2 (caused backwards movement)
};
