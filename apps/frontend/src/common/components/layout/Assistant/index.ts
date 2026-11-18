/**
 * Public API of the shared assistant cube, used by any page that shows it.
 * Import from '@/common/components/layout/Assistant', not from the files
 * inside, so the internals can move without touching callers.
 */
export { pose, type EyeReactions } from './face/pose';
export { GazeReactions, type GazeContext } from './face/gazeReactions';
export {
  FACE_H,
  FACE_ROUND,
  FACE_W,
  FaceRenderer,
  useFaceTexture,
  type FaceShape,
} from './face/useFaceTexture';
export { AssistantAnchor, type AssistantAnchorProps } from './anchors/AssistantAnchor';
export { anchorRegistry, type AnchorEntry, type AnchorOptions } from './anchors/registry';
export { pxToScale, selectAnchor, type AnchorTarget } from './anchors/selectAnchor';
export { AssistantHost } from './AssistantHost';
export { CUBE_MODEL_URL, CubeModel } from './scene/CubeModel';
export { AssistantCube, CUBE_SIZE } from './scene/AssistantCube';
export { AssistantRig } from './scene/AssistantRig';
export type { AssistantDirector, DirectorFrame, DirectorPose } from './scene/director';
export {
  useAssistantAccessory,
  useAssistantDirector,
  useAssistantScene,
} from './scene/useAssistantScene';
export { prefersReducedMotion } from './utils/motion';
export {
  isAssistantActive,
  useAssistantStore,
  type AssistantScreen,
  type Emotion,
} from './store/assistant.Store';
export { useWheelForward } from './ui/useWheelForward';
