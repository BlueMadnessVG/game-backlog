import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

import type { BillboardConfig } from '../types/billboard';

export interface CollisionBox {
  readonly center: THREE.Vector3;
  readonly halfSizes: THREE.Vector3;
  readonly orientation: THREE.Matrix3;
}

/**
 * Crea una OBB (Oriented Bounding Box) a partir de la configuración física de un Billboard.
 */
export function createBillboardOBB(
  config: BillboardConfig,
  frameThickness: number,
  frameDepth: number,
): OBB {
  const { position, width, height, rotation } = config;

  const center = new THREE.Vector3(position[0], position[1], position[2]);

  // El tamaño completo incluye los bordes del marco decorativo
  const halfSizes = new THREE.Vector3(
    (width + frameThickness * 2) / 2,
    (height + frameThickness * 2) / 2,
    frameDepth / 2,
  );

  const euler = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
  const orientation = new THREE.Matrix3().setFromMatrix4(
    new THREE.Matrix4().makeRotationFromEuler(euler),
  );

  return new OBB(center, halfSizes, orientation);
}

/**
 * Crea una OBB dinámica basada en el estado actual de la malla del coche.
 * Asume dimensiones fijas basadas en los argumentos geométricos del Car.
 */
export function createCarOBB(carGroup: THREE.Group): OBB {
  const center = carGroup.position.clone();

  // Geometría del coche: boxGeometry args={[1.6, 0.6, 3]}
  const halfSizes = new THREE.Vector3(1.6 / 2, 0.6 / 2, 3 / 2);

  const orientation = new THREE.Matrix3().setFromMatrix4(carGroup.matrixWorld);

  return new OBB(center, halfSizes, orientation);
}

/**
 * Resuelve la colisión empujando el coche fuera del volumen intersectado
 * utilizando el punto más cercano en la superficie del OBB.
 */
export function resolveCollision(carGroup: THREE.Group, billboardOBB: OBB): THREE.Vector3 {
  const carOBB = createCarOBB(carGroup);

  if (!carOBB.intersectsOBB(billboardOBB)) {
    return carGroup.position;
  }

  // Encontrar el punto más cercano en el billboard desde el centro del auto
  const closestPoint = new THREE.Vector3();
  billboardOBB.clampPoint(carGroup.position, closestPoint);

  // Calcular vector de penetración
  const pushDirection = new THREE.Vector3().subVectors(carGroup.position, closestPoint);

  // Si el centro está perfectamente alineado, evitar división por cero
  if (pushDirection.lengthSq() === 0) {
    pushDirection.set(0, 0, 1);
  }

  // Definir un umbral de seguridad basado en el tamaño medio del vehículo para la expulsión
  const safetyBuffer = 1.0;
  pushDirection.normalize().multiplyScalar(safetyBuffer);

  return new THREE.Vector3().addVectors(closestPoint, pushDirection);
}
