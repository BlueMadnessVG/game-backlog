/**
 * Brand-accent hex colors per platform, shared by the 3D holograms, the DOM
 * info panel and the HUD so every platform surface renders the same color.
 *
 * Exports:
 *  - Per-platform color constants (PS_BLUE, XBOX_GREEN, STEAM_BLUE,
 *    UNIFIED_AMBER).
 *  - PlatformKey: union of the four supported platform ids.
 *  - PLATFORM_COLORS: Record<PlatformKey, string> for keyed lookups.
 */
export const PS_BLUE = '#1e88e5';
export const XBOX_GREEN = '#3fb950';
export const STEAM_BLUE = '#66c0f4';
export const UNIFIED_AMBER = '#ff6600';

export type PlatformKey = 'steam' | 'xbox' | 'playstation' | 'unified';

export const PLATFORM_COLORS: Record<PlatformKey, string> = {
  steam: STEAM_BLUE,
  xbox: XBOX_GREEN,
  playstation: PS_BLUE,
  unified: UNIFIED_AMBER,
};
