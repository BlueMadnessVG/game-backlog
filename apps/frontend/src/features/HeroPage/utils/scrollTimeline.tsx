import type { PlatformKey } from './platformColors';

/**
 * Single source of truth for scroll-progress thresholds shared between the
 * 3D controller (button glow / hologram activation) and DOM content
 * (FeatureCallouts). `progress` here is relative to the dedicated
 * hero-sequence spacer in HeroPageManager, not the whole page.
 */
export const DOCK_COMPLETE = 0.35;

/**
 * Hero-exit choreography (hero-relative progress). The sequence is strictly
 * staged so each beat finishes before the next begins:
 *  1. platform holograms play out (all off by 0.80),
 *  2. the controller glides back to dead-center, face-on,
 *  3. the camera pushes into the controller middle,
 *  4. the whole scene slowly banishes so the first chapter section reads as
 *     rising up from the bottom of the viewport.
 */
export const CONTROLLER_CENTER_START = 0.82;
export const CONTROLLER_CENTER_END = 0.9;

export const CAMERA_CLOSEUP_START = 0.9;
export const CAMERA_CLOSEUP_END = 0.97;

export const HUD_FADE_START = 0.84;
export const HUD_FADE_END = 0.9;

export const SCENE_FADE_START = 0.9;
export const SCENE_FADE_END = 1;

/**
 * Global page-progress window around the hero→chapters handoff. The docked
 * mini-controller mounts once `progress >= heroEnd + DOCK_SPAN`, where
 * `heroEnd` is measured (see useChapterMeasurement) as the moment the
 * contentBelow section reaches the viewport top.
 */
export const DOCK_LEAD = 0.02;
export const DOCK_SPAN = 0.05;

const ACTIVATION_START = 0.3;
const ACTIVATION_END = 0.98;
const ACTIVATION_SPAN = ACTIVATION_END - ACTIVATION_START;

function rangeFromGlow(glowStart: number, glowEnd: number): [number, number] {
  return [
    ACTIVATION_START + glowStart * ACTIVATION_SPAN,
    ACTIVATION_START + glowEnd * ACTIVATION_SPAN,
  ];
}

export const PLATFORM_TIMELINE: Record<PlatformKey, [number, number]> = {
  steam: rangeFromGlow(0.15, 0.3),
  xbox: rangeFromGlow(0.31, 0.45),
  playstation: rangeFromGlow(0.46, 0.6),
  unified: rangeFromGlow(0.61, 0.8),
};
