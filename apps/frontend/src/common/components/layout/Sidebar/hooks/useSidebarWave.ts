import { useCallback, useEffect, useRef } from 'react';

import { useMotionValue, useSpring } from 'framer-motion';

export const useSidebarWave = () => {
  const mouseY = useMotionValue(0);
  const rafId = useRef<number | null>(null);

  const smoothMouseY = useSpring(mouseY, {
    damping: 20,
    stiffness: 100,
    mass: 0.5,
  });

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { clientY, currentTarget } = e;

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        const rect = currentTarget.getBoundingClientRect();
        mouseY.set(clientY - rect.top);
      });
    },
    [mouseY],
  );

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return { smoothMouseY, onMouseMove };
};
