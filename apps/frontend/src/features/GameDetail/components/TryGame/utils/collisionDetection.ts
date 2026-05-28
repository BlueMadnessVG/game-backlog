// utils/collisionDetection.ts
import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

import type { BillboardConfig } from '../types/billboard';

export function createBillboardOBB(
  config: BillboardConfig,
  frameThickness: number,
  frameDepth: number,
): OBB {
  const center = new THREE.Vector3(config.position[0], config.position[1], config.position[2]);
  const halfSizes = new THREE.Vector3(
    (config.width + frameThickness * 2) / 2,
    (config.height + frameThickness * 2) / 2,
    frameDepth / 2,
  );
  const euler = new THREE.Euler(config.rotation[0], config.rotation[1], config.rotation[2]);
  const orientation = new THREE.Matrix3().setFromMatrix4(
    new THREE.Matrix4().makeRotationFromEuler(euler),
  );
  return new OBB(center, halfSizes, orientation);
}

export function createCarOBB(carGroup: THREE.Group): OBB {
  const center = carGroup.position.clone();
  const halfSizes = new THREE.Vector3(1.6 / 2, 0.6 / 2, 3 / 2);
  const orientation = new THREE.Matrix3().setFromMatrix4(carGroup.matrixWorld);
  return new OBB(center, halfSizes, orientation);
}

/**
 * Resuelve la colisión calculando el Vector de Mínima Penetración (MTV).
 * Si hay colisión, expulsa al coche de forma matemática fuera del volumen.
 */
export function resolveCollision(carGroup: THREE.Group, billboardOBB: OBB): THREE.Vector3 {
  const carOBB = createCarOBB(carGroup);

  // Early return si no hay intersección geométrica real
  if (!carOBB.intersectsOBB(billboardOBB)) {
    return carGroup.position;
  }

  // Vector de distancia entre los centros de ambos objetos
  const distanceVector = new THREE.Vector3().subVectors(carGroup.position, billboardOBB.center);

  // Obtener los ejes locales de la rotación del Billboard (Matriz de orientación de 3x3)
  const billboardAxes = [
    new THREE.Vector3(
      billboardOBB.rotation.elements[0],
      billboardOBB.rotation.elements[1],
      billboardOBB.rotation.elements[2],
    ), // Eje X local
    new THREE.Vector3(
      billboardOBB.rotation.elements[3],
      billboardOBB.rotation.elements[4],
      billboardOBB.rotation.elements[5],
    ), // Eje Y local
    new THREE.Vector3(
      billboardOBB.rotation.elements[6],
      billboardOBB.rotation.elements[7],
      billboardOBB.rotation.elements[8],
    ), // Eje Z local
  ];

  // Tamaños combinados de las cajas (Anuncio + Coche) en los ejes locales del anuncio
  // Aproximación del peor de los casos para la extensión del coche (diagonal media = ~1.8)
  const carExtend = 1.8;
  const limits = [
    billboardOBB.halfSize.x + carExtend,
    billboardOBB.halfSize.y + 0.3, // Altura media del coche
    billboardOBB.halfSize.z + carExtend,
  ];

  const pushVector = new THREE.Vector3();
  let minOverlap = Infinity;
  const bestAxis = new THREE.Vector3(0, 0, 1);

  // Encontrar cuál es el eje más plano/corto por el cual expulsar al coche para evitar que se fusione
  for (let i = 0; i < 3; i++) {
    const axis = billboardAxes[i].normalize();
    const projection = distanceVector.dot(axis);
    const overlap = limits[i] - Math.abs(projection);

    if (overlap > 0 && overlap < minOverlap) {
      minOverlap = overlap;
      // Determinar la dirección de la fuerza de empuje
      bestAxis.copy(axis).multiplyScalar(projection >= 0 ? 1 : -1);
    }
  }

  // Margen de seguridad estricto para evitar micro-solapamientos flotantes en el próximo frame
  const safetyBuffer = 0.05;
  pushVector.copy(bestAxis).multiplyScalar(minOverlap + safetyBuffer);

  // Retornar la posición corregida sumando el vector de empuje libre
  return carGroup.position.clone().add(pushVector);
}
