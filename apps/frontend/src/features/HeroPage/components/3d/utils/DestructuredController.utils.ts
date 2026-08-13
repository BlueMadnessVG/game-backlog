import * as THREE from 'three';
import { lerp } from 'three/src/math/MathUtils.js';

/**
 * Shared per-frame helpers for the DeconstructedController.
 *
 * Exports:
 *  - updateButton(depressRef, glowRef): default export; eases a face-button
 *    group toward its pressed (y = -1.5) or resting (y = 0) height based on
 *    the current glow state, giving the 3D depress effect.
 */
export default function updateButton(
  depressRef: React.MutableRefObject<THREE.Group | null>,
  glowRef: React.MutableRefObject<boolean>,
) {
  if (depressRef.current) {
    depressRef.current.position.y = lerp(
      depressRef.current.position.y,
      glowRef.current ? -1.5 : 0,
      0.2,
    );
  }
}
