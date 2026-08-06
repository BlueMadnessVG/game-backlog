import { useEffect } from 'react';
import type { RefObject } from 'react';

import { useMotionValueEvent, useScroll } from 'framer-motion';

import { useScrollStore } from '../store/heroPageScroll.Store';

export function useScrollSync(
  container: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
) {
  const { scrollYProgress } = useScroll({
    container,
    target,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= el.clientHeight;
      el.scrollTop += delta;
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [container]);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    useScrollStore.getState().setProgress(latest);
  });

  return scrollYProgress;
}
