import { useCallback } from 'react';

import { animate, useMotionValue } from 'framer-motion';

export const useSidebarPulse = () => {
  const pulsY = useMotionValue(-1000);
  const pulseProgress = useMotionValue(0);

  const triggerPulse = useCallback(
    (y: number) => {
      pulsY.set(y);
      pulseProgress.set(0);

      animate(pulseProgress, 1, {
        duration: 0.8,
        ease: 'easeOut',
        onComplete: () => pulsY.set(-1000),
      });
    },
    [pulsY, pulseProgress],
  );

  return { pulsY, pulseProgress, triggerPulse };
};
