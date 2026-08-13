import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import {
  useButtonHotspotsStore,
  type HeroButtonKey,
} from '../../store/heroButtonHotspots.Store';

/**
 * Projects the four controller face buttons into DOM pixel coordinates.
 *
 * Lives inside the Canvas. Each frame it resolves the world position of each
 * `Hotspot-*` anchor object, projects it through the camera into client
 * pixel space, and writes { x, y, visible } to useButtonHotspotsStore so the
 * DOM hotspot overlay can render click targets on top of the (non-interactive)
 * scene. Geometry centers are cached per mesh via WeakMap.
 *
 * Exports:
 *  - ButtonProjector: a renderless component mounted in the Canvas.
 */
const _v = new THREE.Vector3();

const _geometryCenter = new WeakMap<THREE.BufferGeometry, THREE.Vector3>();

function getButtonMesh(anchor: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  anchor.traverse((obj) => {
    if (!found && (obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).geometry) {
      found = obj as THREE.Mesh;
    }
  });
  return found;
}

const BUTTON_ANCHORS: { key: HeroButtonKey; objectName: string }[] = [
  { key: 'square', objectName: 'Hotspot-Square' },
  { key: 'triangle', objectName: 'Hotspot-Triangle' },
  { key: 'cross', objectName: 'Hotspot-Cross' },
  { key: 'circle', objectName: 'Hotspot-Circle' },
];

export function ButtonProjector() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const scene = useThree((state) => state.scene);

  useFrame(() => {
    const { setHotspot } = useButtonHotspotsStore.getState();

    for (const { key, objectName } of BUTTON_ANCHORS) {
      const anchor = scene.getObjectByName(objectName);
      const mesh = anchor ? getButtonMesh(anchor) : null;
      if (!mesh?.geometry) {
        setHotspot(key, 0, 0, false);
        continue;
      }

      let center = _geometryCenter.get(mesh.geometry);
      if (!center) {
        center = new THREE.Vector3();
        mesh.geometry.computeBoundingBox();
        mesh.geometry.boundingBox.getCenter(center);
        _geometryCenter.set(mesh.geometry, center);
      }

      _v.copy(center);
      mesh.localToWorld(_v);
      _v.project(camera);

      const visible = _v.z > -1 && _v.z < 1;
      const x = (_v.x * 0.5 + 0.5) * size.width;
      const y = (-_v.y * 0.5 + 0.5) * size.height;
      setHotspot(key, x, y, visible);
    }
  });

  return null;
}
