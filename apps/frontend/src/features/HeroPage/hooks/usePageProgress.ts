import type { RefObject } from 'react';

import { useMotionValueEvent, useScroll } from 'framer-motion';

import { usePageProgressStore } from '../store/pageProgress.Store';

/**
 * Page-level scroll progress for the hero → chapters handoff.
 *
 * Unlike useScrollSync (hero-relative), this tracks progress across the
 * whole scroll container and writes it into usePageProgressStore, which also
 * carries the measured heroEnd and chapter ranges. Consumers combine these to
 * decide when the docked mini-controller mounts and which chapter is active.
 *
 * Exports:
 *  - usePageProgress(container): returns the live MotionValue and keeps the
 *    store in sync.
 */
export function usePageProgress(container: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ container });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    usePageProgressStore.getState().setProgress(latest);
  });

  return scrollYProgress;
}
