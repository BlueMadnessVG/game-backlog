import * as THREE from 'three';
import { lerp } from 'three/src/math/MathUtils.js';

export default function updateButton(
  depressRef: React.MutableRefObject<THREE.Group | null>,
  bleedRef: React.MutableRefObject<THREE.Mesh | null>,
  glowRef: React.MutableRefObject<boolean>,
) {
  if (depressRef.current) {
    depressRef.current.position.y = lerp(
      depressRef.current.position.y,
      glowRef.current ? -1.5 : 0,
      0.2,
    );
  }

  if (bleedRef.current) {
    const target = glowRef.current ? 1 : 0;
    const s = lerp(bleedRef.current.scale.x, target, 0.12);
    bleedRef.current.scale.setScalar(s);
  }
}
