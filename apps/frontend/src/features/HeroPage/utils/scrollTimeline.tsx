import type { PlatformKey } from './platformColors';

/**
 * Hero-page scroll choreography constants and helpers.
 *
 * Every export here is expressed in "hero-relative" progress, where 0 is the
 * moment the hero sequence spacer enters the viewport and 1 is the moment it
 * exits at the top. This module is the single source of truth so the 3D
 * controller, the DOM info panel, and the HUD all read the same thresholds
 * and stay in lockstep.
 *
 * Exports fall into three groups:
 *  - Thresholds: DOCK_COMPLETE, HOLOGRAM_GATE_END, and the hero-exit beat
 *    windows (CONTROLLER_CENTER_*, CAMERA_CLOSEUP_*, HUD_FADE_*, SCENE_FADE_*).
 *  - Timelines: PLATFORM_TIMELINE (per-platform glow/hologram activation
 *    windows) and DISPLAY_TIMELINE (panel display order).
 *  - Helpers: activeDisplayIndex(progress) resolves which platform is on
 *    stage at a given progress value.
 */
/**
 * Single source of truth for scroll-progress thresholds shared between the
 * 3D controller (button glow / hologram activation) and DOM content
 * (FeatureDisplayPanel). `progress` here is relative to the dedicated
 * hero-sequence spacer in HeroPageManager, not the whole page.
 */
export const DOCK_COMPLETE = 0.35;

/**
 * Hard end of the platform-hologram sequence (hero-relative progress). Past
 * this value the controller kills every hologram (DestructedController) and
 * the DOM info panel drops out of view, keeping both in lockstep.
 */
export const HOLOGRAM_GATE_END = 0.8;

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

/**
 * Display order for the DOM info panel — one entry per platform hologram,
 * numbered in scroll-activation order (1 = steam … 4 = unified).
 */
export const DISPLAY_TIMELINE: { key: PlatformKey; display: number }[] = [
  { key: 'steam', display: 1 },
  { key: 'xbox', display: 2 },
  { key: 'playstation', display: 3 },
  { key: 'unified', display: 4 },
];

/**
 * Which display is currently on stage for a given hero-relative progress.
 * Returns 0 outside the activation window; inside it, holds the most
 * recently reached display so the short gaps between platform windows
 * never blank the panel.
 */
export function activeDisplayIndex(progress: number): number {
  if (progress < ACTIVATION_START || progress >= HOLOGRAM_GATE_END) return 0;

  let current = 0;
  for (const { key, display } of DISPLAY_TIMELINE) {
    const [start, end] = PLATFORM_TIMELINE[key];
    if (progress >= start) current = display;
    if (progress < end) break;
  }
  return current;
}
