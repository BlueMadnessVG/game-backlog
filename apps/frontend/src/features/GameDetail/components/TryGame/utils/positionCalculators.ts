import * as THREE from 'three';

const FORWARD_DIRECTION = new THREE.Vector3(0, 0, 1);

export const calculateCarPosition = (
  currentPosition: Readonly<THREE.Vector3>,
  currentRotation: number,
  speed: number,
  deltaTime: number,
): THREE.Vector3 => {
  const newPosition = currentPosition.clone();
  const forwardVector = FORWARD_DIRECTION.clone();

  forwardVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation);
  forwardVector.multiplyScalar(speed * deltaTime);

  newPosition.add(forwardVector);

  return newPosition;
};
