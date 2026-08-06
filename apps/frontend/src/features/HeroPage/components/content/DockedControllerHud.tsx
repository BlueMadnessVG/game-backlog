import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';

import styles from './css/DockedControllerHud.module.css';
import {
  usePageProgressStore,
  getActiveRange,
} from '../../store/pageProgress.Store';
import { DOCK_LEAD } from '../../utils/scrollTimeline';
import { SECTIONS, type ChapterId } from '../../utils/sections';
import { DockedController } from '../3d/DockedController';

/**
 * Fixed corner HUD that appears once the hero sequence has docked. Renders a
 * small procedural controller-face plus a caption for the active chapter. The
 * caption re-renders only when the active chapter changes; the 3D glow is
 * driven inside the canvas via the shared store.
 */
export function DockedControllerHud() {
  const [activeId, setActiveId] = useState<ChapterId | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return usePageProgressStore.subscribe((state) => {
      const range = getActiveRange(state.progress, state.chapters);
      setActiveId((range?.id as ChapterId | undefined) ?? null);
      setVisible(state.progress >= state.heroEnd + DOCK_LEAD);
    });
  }, []);

  const chapter = activeId ? SECTIONS.find((c) => c.id === activeId) : undefined;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.dock}
          style={{ '--accent': chapter?.accent ?? '#555555' } as CSSProperties}
          initial={{ opacity: 0, y: -18, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -18, scale: 0.92 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          aria-hidden="true"
        >
          <div className={styles.canvas}>
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 4.2], fov: 35 }}>
              <ambientLight intensity={0.7} />
              <DockedController />
            </Canvas>
            <div className={styles.scan} aria-hidden="true" />
          </div>

          <div className={styles.caption}>
            <span className={styles.kicker}>
              {chapter ? 'ACTIVE CHAPTER' : 'SIGNAL LOST'}
            </span>
            <span className={styles.title}>
              {chapter
                ? `${String(chapter.index).padStart(2, '0')} // ${chapter.kicker}`
                : 'SYSTEM IDLE'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DockedControllerHud;
