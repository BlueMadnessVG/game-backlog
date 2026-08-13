import { createContext, useContext, type ReactNode } from 'react';

import type { MotionValue } from 'framer-motion';

/**
 * React context carrying the hero scroll-progress MotionValue.
 *
 * The MotionValue is created once by the hero controller (via
 * useScrollProgress / the scroll container) and passed down here so any
 * subtree — 3D scene, HUD, DOM panels — can read the same animated number
 * without prop drilling.
 *
 * Exports:
 *  - ScrollProgressProvider: mounts the context with a given MotionValue.
 *  - useScrollProgressValue(): reads it, throwing outside the provider.
 */
const ScrollProgressContext = createContext<MotionValue<number> | null>(null);

export function ScrollProgressProvider({
  value,
  children,
}: {
  value: MotionValue<number>;
  children: ReactNode;
}) {
  return <ScrollProgressContext.Provider value={value}>{children}</ScrollProgressContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScrollProgressValue(): MotionValue<number> {
  const context = useContext(ScrollProgressContext);
  if (!context) {
    throw new Error('useScrollProgressValue must be used within a ScrollProgressProvider');
  }
  return context;
}
