import { useSyncExternalStore } from 'react';

import { QUERIES } from './utils/mediaQueryBreackpoints.utils';

/**
 * useMediaQuery hook
 * Uses useSyncExternalStore for high-performance, concurrent-safe browser state syncing.
 * * Features:
 * - No "flicker": Handles SSR/Hydration gracefully via getServerSnapshot.
 * - Performance: Minimal re-renders by subscribing directly to the MediaQueryList.
 * - Clean API: No need for manual 'mounted' state flags.
 *
 * @param query The media query string (e.g., "(max-width: 767px)")
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 767px)");
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const matchMedia = window.matchMedia(query);
    matchMedia.addEventListener('change', callback);
    return () => matchMedia.removeEventListener('change', callback);
  };

  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const useIsMobile = () => useMediaQuery(QUERIES.isMobile);
export const useIsTablet = () => useMediaQuery(QUERIES.isTablet);
export const useIsDesktop = () => useMediaQuery(QUERIES.isDesktop);
