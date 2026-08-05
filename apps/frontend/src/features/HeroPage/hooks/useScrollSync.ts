import type { RefObject } from 'react';

import { useMotionValueEvent, useScroll } from 'framer-motion';

import { useScrollStore } from '../store/heroPageScroll.Store';

export function useScrollSync(target: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({
    target,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    useScrollStore.getState().setProgress(latest);
  });
}
