/**
 * The two progress frames on the Hero page and the one conversion between them.
 *
 *  - Page progress: 0..1 across the whole scroll container.
 *  - Hero progress: 0..1 across the hero sequence spacer (what the
 *    choreography is written in).
 */

/** The page-progress span the hero sequence covers. */
export interface HeroWindow {
  start: number;
  end: number;
}

/** Used until the first measurement lands. */
export const DEFAULT_HERO_WINDOW: HeroWindow = { start: 0, end: 0.3 };

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function heroToPage(h: number, window: HeroWindow): number {
  return window.start + h * (window.end - window.start);
}

/** Clamped: before the hero is 0, after it is 1. A zero-width window is 0. */
export function pageToHero(p: number, window: HeroWindow): number {
  const span = window.end - window.start;
  if (span <= 0) return 0;
  return clamp01((p - window.start) / span);
}
