import type { RefObject } from 'react';

import { useMotionValueEvent, useScroll } from 'framer-motion';

import { usePageProgressStore } from '../store/pageProgress.Store';

export function usePageProgress(container: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ container });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    usePageProgressStore.getState().setProgress(latest);
  });

  return scrollYProgress;
}
