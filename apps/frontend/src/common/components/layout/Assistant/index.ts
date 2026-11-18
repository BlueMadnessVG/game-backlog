/**
 * Public API of the app-wide assistant cube, used by any page that shows it.
 * Import from '@/common/components/layout/Assistant', not from the files
 * inside, so the internals can move without touching callers.
 *
 * Nothing exported here imports three.js, so using an anchor or a hook never
 * pulls the 3D code into a page's bundle — the canvas is lazy-loaded by
 * AssistantHost. The 3D internals (rig, cube, face) live in './three'.
 */
export { AssistantAnchor, type AssistantAnchorProps } from './anchors/AssistantAnchor';
export { anchorRegistry, type AnchorEntry, type AnchorOptions } from './anchors/registry';
export { pxToScale, selectAnchor, type AnchorTarget } from './anchors/selectAnchor';
export { AssistantHost } from './AssistantHost';
export { pose, type EyeReactions } from './face/pose';
export type { AssistantDirector, DirectorFrame, DirectorPose } from './scene/director';
export {
  useAssistantAccessory,
  useAssistantDirector,
  useAssistantScene,
} from './scene/useAssistantScene';
export {
  isAssistantActive,
  isAssistantStill,
  useAssistantStore,
  type AssistantScreen,
  type Emotion,
} from './store/assistant.Store';
export { useWheelForward } from './ui/useWheelForward';
export { prefersReducedMotion, subscribeReducedMotion } from './utils/motion';
