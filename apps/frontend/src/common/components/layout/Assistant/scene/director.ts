import type { Emotion } from '../store/assistant.Store';

/**
 * A director lets a page choreograph the cube frame by frame (an entry
 * animation, a scroll timeline…) instead of only docking it to anchors. The
 * rig calls it once per frame and blends its pose with the anchor pose by
 * `dockBlend`. Register one with useAssistantDirector.
 *
 * Exports:
 *  - DirectorFrame: what the rig passes in.
 *  - DirectorPose: what a director returns.
 *  - AssistantDirector: the director function type.
 */
export interface DirectorFrame {
  /** Clock time and frame delta, in seconds (delta capped at 0.05). */
  t: number;
  dt: number;
  /** The viewer asked for reduced motion. */
  still: boolean;
  /** Visible half-width/height of the camera at the cube's depth, world units. */
  halfW: number;
  halfH: number;
  /** Canvas size in pixels. */
  width: number;
  height: number;
}

export interface DirectorPose {
  /** 0: use this pose; 1: dock to the chosen anchor; in between: blend. */
  dockBlend: number;
  /** This pose's position (world units) and scale, before idle motion. */
  x: number;
  y: number;
  scale: number;
  /** Multiplies the final scale (e.g. grow in on entry). Default 1. */
  scaleMul?: number;
  /** Extra rotation (radians) added on top of gaze, sway and emotion. */
  rx?: number;
  ry?: number;
  rz?: number;
  /** NDC x this pose is heading to, used to detect a left/right switch. */
  headingX?: number;
  /** Face while not docked (default idle). */
  emotion?: Emotion;
  /** When true, `emotion` wins even while docked (e.g. asleep before ready). */
  emotionLocked?: boolean;
  /** Draw the cube at all. Default true. */
  visible?: boolean;
  /** Show the cube button and speech bubble. Default true. */
  interactive?: boolean;
}

export type AssistantDirector = (frame: DirectorFrame) => DirectorPose | null;
