import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lerp } from 'three/src/math/MathUtils.js';

import { useScrollStore } from '../../store/heroPageScroll.Store';
import {
  CAMERA_CLOSEUP_END,
  CAMERA_CLOSEUP_START,
} from '../../utils/scrollTimeline';

/**
 * Scroll-driven camera rig for the hero exit. Once the platform activations
 * complete and the controller has glided back to dead-center, the camera eases
 * into the controller middle (a dolly-in via z-position plus fov) aimed at the
 * face center. Purely functional — reads the shared scroll store every frame,
 * so it stays in sync with the controller pose without any re-renders.
 *
 * Exports:
 *  - CameraRig: renderless component mounted in the Canvas (default export
 *    too).
 */
function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function CameraRig() {
  useFrame(({ camera: cam }) => {
    const camera = cam as THREE.PerspectiveCamera;
    const r = useScrollStore.getState().progress;
    const p = smoothstep(CAMERA_CLOSEUP_START, CAMERA_CLOSEUP_END, r);

    camera.position.set(0, lerp(0, 0.08, p), lerp(5, 2.6, p));
    camera.fov = lerp(35, 23, p);
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export default CameraRig;
