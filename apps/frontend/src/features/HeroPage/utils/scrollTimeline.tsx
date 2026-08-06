import type { PlatformKey } from './platformColors';

/**
 * Single source of truth for scroll-progress thresholds shared between the
 * 3D controller (button glow / hologram activation) and DOM content
 * (FeatureCallouts). `progress` here is relative to the dedicated
 * hero-sequence spacer in HeroPageManager, not the whole page.
 */
export const DOCK_COMPLETE = 0.35;

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
  steam: rangeFromGlow(0.15, 0.38),
  xbox: rangeFromGlow(0.38, 0.62),
  playstation: rangeFromGlow(0.62, 0.85),
  unified: rangeFromGlow(0.85, 1),
};
