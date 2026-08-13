import type { RefObject } from 'react';

import { useMotionValueEvent, useScroll } from 'framer-motion';

import { useScrollStore } from '../store/heroPageScroll.Store';

/**
 * Binds a framer-motion scroll progress to the plain-number store.
 *
 * Measures the hero sequence (container → target, 'start start' → 'end end')
 * and pushes every scrollYProgress change into useScrollStore so non-Motion
 * subscribers (HUD, counters) read the same value.
 *
 * Exports:
 *  - useScrollSync(container, target): returns the live MotionValue and keeps
 *    the store in sync.
 */
export function useScrollSync(
  container: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
) {
  const { scrollYProgress } = useScroll({
    container,
    target,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    useScrollStore.getState().setProgress(latest);
  });

  return scrollYProgress;
}
