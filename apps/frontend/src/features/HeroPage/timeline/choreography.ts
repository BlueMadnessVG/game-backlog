import type { PlatformKey } from '../utils/platformColors';

/**
 * Hero-page scroll choreography, expressed in hero-relative progress: 0 is the
 * moment the hero sequence spacer pins to the top of the scroll container, 1
 * is the moment its bottom reaches the container's bottom.
 *
 * This is the single source of truth for every beat, so the 3D controller,
 * the DOM panel, the HUD and the rail all read the same thresholds — and ask
 * {@link at} rather than re-deriving "which platform is on stage".
 */

/** Controller finishes its dock tilt/pull-back. */
export const DOCK_COMPLETE = 0.35;

/**
 * Hard end of the platform-hologram sequence. Past this every hologram is off
 * and the DOM panel drops out of view.
 */
export const HOLOGRAM_GATE_END = 0.8;

/**
 * Hero-exit choreography, strictly staged so each beat finishes before the
 * next begins:
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

export const ACTIVATION_START = 0.3;
const ACTIVATION_END = 0.98;
const ACTIVATION_SPAN = ACTIVATION_END - ACTIVATION_START;

function rangeFromGlow(glowStart: number, glowEnd: number): [number, number] {
  return [
    ACTIVATION_START + glowStart * ACTIVATION_SPAN,
    ACTIVATION_START + glowEnd * ACTIVATION_SPAN,
  ];
}

/** Per-platform hologram window, `[start, end)` in hero progress. */
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

export interface TimelineState {
  /**
   * The platform whose hologram is live: `h` inside its `[start, end)` window
   * and before {@link HOLOGRAM_GATE_END}. `null` in the gaps. Drives the
   * controller glow and the rail.
   */
  platform: PlatformKey | null;
  /**
   * The panel's display number (1–4), holding the most recently reached
   * platform through the short gaps so the panel never blanks mid-sequence.
   * 0 outside the activation window.
   */
  display: number;
}

/** What is on stage at hero progress `h`. Pure. */
export function at(h: number): TimelineState {
  if (h < ACTIVATION_START || h >= HOLOGRAM_GATE_END) {
    return { platform: null, display: 0 };
  }

  let platform: PlatformKey | null = null;
  let display = 0;

  for (const { key, display: number } of DISPLAY_TIMELINE) {
    const [start, end] = PLATFORM_TIMELINE[key];
    if (h < start) break;
    display = number;
    if (h < end) {
      platform = key;
      break;
    }
  }

  return { platform, display };
}
