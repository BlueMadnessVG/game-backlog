import { useEffect, useState } from 'react';

import { useProgress } from '@react-three/drei';
import { AnimatePresence, animate, motion } from 'framer-motion';

import styles from './css/LoadCounter.module.css';
import { useAssistantStore } from '../../store/assistant.Store';
import { prefersReducedMotion } from '../../utils/motion';

/**
 * Full-screen percentage counter shown while the scene wakes up. It counts to
 * 100 over a fixed time, but never runs ahead of the asset loader once real
 * assets are loading (the placeholder cube has none; a GLB later will).
 * When it reaches 100 it flips `ready` in the assistant store — the one
 * orchestrated moment of the page: the title splits and the cube spins in.
 *
 * Exports:
 *  - LoadCounter (default export too).
 */
const COUNT_SECONDS = 1.4;

export function LoadCounter() {
  const { progress, total } = useProgress();
  const ready = useAssistantStore((s) => s.ready);
  const setReady = useAssistantStore((s) => s.setReady);
  const [timed, setTimed] = useState(() => (prefersReducedMotion() ? 100 : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const controls = animate(0, 100, {
      duration: COUNT_SECONDS,
      ease: 'easeInOut',
      onUpdate: (v) => setTimed(v),
    });
    return () => controls.stop();
  }, []);

  const shown = Math.floor(Math.min(timed, total > 0 ? progress : 100));

  useEffect(() => {
    if (shown < 100 || ready) return;
    const id = window.setTimeout(setReady, 200);
    return () => window.clearTimeout(id);
  }, [shown, ready, setReady]);

  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          className={styles.counter}
          role="status"
          aria-live="polite"
          aria-label={`Loading ${shown} percent`}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className={styles.value} aria-hidden>
            {String(shown).padStart(3, '0')}%
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoadCounter;
