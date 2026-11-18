/**
 * The assistant's 3D internals (they import three.js and R3F). Pages normally
 * don't need these — the shared canvas renders them — and should import from
 * the main barrel ('./index') instead, which stays free of three.js.
 */
export { GazeReactions, type GazeContext } from './face/gazeReactions';
export {
  FACE_H,
  FACE_ROUND,
  FACE_W,
  FaceRenderer,
  useFaceTexture,
  type FaceShape,
} from './face/useFaceTexture';
export { AssistantCanvas } from './scene/AssistantCanvas';
export { AssistantCube, CUBE_SIZE } from './scene/AssistantCube';
export { AssistantRig } from './scene/AssistantRig';
export { CUBE_MODEL_URL, CubeModel } from './scene/CubeModel';
