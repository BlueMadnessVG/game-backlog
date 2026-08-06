export const PS_BLUE = '#003791';
export const XBOX_GREEN = '#107C10';
export const STEAM_GREY = '#2a475e';
export const UNIFIED_AMBER = '#ff6600';

export type PlatformKey = 'steam' | 'xbox' | 'playstation' | 'unified';

export const PLATFORM_COLORS: Record<PlatformKey, string> = {
  steam: STEAM_GREY,
  xbox: XBOX_GREEN,
  playstation: PS_BLUE,
  unified: UNIFIED_AMBER,
};
