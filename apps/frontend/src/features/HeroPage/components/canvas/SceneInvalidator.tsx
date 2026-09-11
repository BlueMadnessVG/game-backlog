import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';

import { useButtonHotspotsStore } from '../../store/heroButtonHotspots.Store';
import { useScrollStore } from '../../store/heroPageScroll.Store';

export function SceneInvalidator() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const unsubScroll = useScrollStore.subscribe((state, prev) => {
      if (state.progress !== prev.progress) invalidate();
    });

    const unsubGlow = useButtonHotspotsStore.subscribe((state, prev) => {
      const glowed = (key: Parameters<typeof state.setGlow>[0]) =>
        state.glow[key] !== prev.glow[key];
      if (glowed('square') || glowed('triangle') || glowed('cross') || glowed('circle')) {
        invalidate();
      }
    });

    return () => {
      unsubScroll();
      unsubGlow();
    };
  }, [invalidate]);

  return null;
}

export default SceneInvalidator;