import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';

import { useAssistantStore } from '../../store/assistant.Store';
import { useButtonHotspotsStore } from '../../store/heroButtonHotspots.Store';
import { heroProgress } from '../../timeline';

/**
 * Requests frames for the demand-driven canvas when something outside the
 * render loop changes: scroll progress, a hotspot glow, the frameloop turning
 * on, or the assistant becoming ready. Once a frame runs, AssistantRig keeps
 * the loop going on its own.
 */
export function SceneInvalidator() {
  const invalidate = useThree((state) => state.invalidate);
  const frameloop = useThree((state) => state.frameloop);

  // Switching 'never' → 'demand' does not request a frame by itself.
  useEffect(() => {
    invalidate();
  }, [frameloop, invalidate]);

  useEffect(() => {
    const unsubScroll = heroProgress.on('change', () => invalidate());

    const unsubGlow = useButtonHotspotsStore.subscribe((state, prev) => {
      const glowed = (key: Parameters<typeof state.setGlow>[0]) =>
        state.glow[key] !== prev.glow[key];
      if (glowed('square') || glowed('triangle') || glowed('cross') || glowed('circle')) {
        invalidate();
      }
    });

    const unsubReady = useAssistantStore.subscribe((state, prev) => {
      if (state.ready !== prev.ready) invalidate();
    });

    return () => {
      unsubScroll();
      unsubGlow();
      unsubReady();
    };
  }, [invalidate]);

  return null;
}

export default SceneInvalidator;
