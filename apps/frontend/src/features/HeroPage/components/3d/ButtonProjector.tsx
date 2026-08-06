import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import {
  useButtonHotspotsStore,
  type HeroButtonKey,
} from '../../store/heroButtonHotspots.Store';

const _v = new THREE.Vector3();

const BUTTON_ANCHORS: { key: HeroButtonKey; objectName: string }[] = [
  { key: 'square', objectName: 'Hotspot-Square' },
  { key: 'triangle', objectName: 'Hotspot-Triangle' },
  { key: 'cross', objectName: 'Hotspot-Cross' },
  { key: 'circle', objectName: 'Hotspot-Circle' },
];

/**
 * Lives inside the Canvas. Each frame it projects the world position of the
 * four controller face buttons into client pixel space and stores it so the
 * DOM hotspot overlay can render click targets on top of the (non-interactive)
 * scene.
 */
export function ButtonProjector() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const scene = useThree((state) => state.scene);

  useFrame(() => {
    const { setHotspot } = useButtonHotspotsStore.getState();

    for (const { key, objectName } of BUTTON_ANCHORS) {
      const anchor = scene.getObjectByName(objectName);
      if (!anchor) {
        setHotspot(key, 0, 0, false);
        continue;
      }

      anchor.getWorldPosition(_v);
      _v.project(camera);

      const visible = _v.z > -1 && _v.z < 1;
      const x = (_v.x * 0.5 + 0.5) * size.width;
      const y = (-_v.y * 0.5 + 0.5) * size.height;
      setHotspot(key, x, y, visible);
    }
  });

  return null;
}
