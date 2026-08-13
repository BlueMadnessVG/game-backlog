import { useRef } from 'react';

import { motion, useTransform } from 'framer-motion';

import { HeroScene } from './components/canvas/HeroScene';
import { FeatureDisplayPanel } from './components/content/FeatureDisplayPanel';
import { HeroButtonHotspots } from './components/content/HeroButtonHotspots';
import { HeroHudChrome } from './components/content/HeroHudChrome';
import { HeroTagline } from './components/content/HeroTagline';
import { ScrollProgressRail } from './components/content/ScrollProgressRail';
import styles from './css/HeroPageManager.module.css';
import { useChapterMeasurement } from './hooks/useChapterMeasurement';
import { usePageProgress } from './hooks/usePageProgress';
import { useScrollSync } from './hooks/useScrollSync';
import { ScrollProgressProvider } from './store/ScrollProgressContext';
import { HUD_FADE_END, HUD_FADE_START } from './utils/scrollTimeline';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * Top-level composition for the HeroPage.
 *
 * Wires the scroll pipelines together: the hero-relative MotionValue
 * (useScrollSync) drives the 3D controller, HUD and DOM panels via
 * ScrollProgressProvider, while page-relative progress (usePageProgress +
 * useChapterMeasurement) feeds the docked mini-controller / rail handoff.
 * Chapter sections are meant to be injected into `contentBelow` and must be
 * tagged `data-chapter` so useChapterMeasurement can map them onto the global
 * progress model.
 */
export function HeroPageManager() {
  const mainRef = useMainScroll();
  const heroSequenceRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useScrollSync(mainRef, heroSequenceRef);

  usePageProgress(mainRef);
  useChapterMeasurement(mainRef, rootRef, contentRef);

  const hudOpacity = useTransform(scrollYProgress, [HUD_FADE_START, HUD_FADE_END], [1, 0]);

  return (
    <div className={styles.heroPage} ref={rootRef}>
      <ScrollProgressProvider value={scrollYProgress}>
        <div className={styles.heroViewport} ref={heroSequenceRef}>
          <div className={styles.sceneStage}>
            <div className={styles.sceneLayer}>
              <HeroScene />
            </div>

            <motion.div style={{ opacity: hudOpacity }} className={styles.hudLayer}>
              <HeroTagline />
              <FeatureDisplayPanel />
              <HeroButtonHotspots />
            </motion.div>
          </div>
        </div>

        <motion.div style={{ opacity: hudOpacity }} className={styles.hudChromeFade}>
          <HeroHudChrome />
        </motion.div>

        <ScrollProgressRail />

        <div className={styles.contentBelow} ref={contentRef}></div>
      </ScrollProgressProvider>
    </div>
  );
}

export default HeroPageManager;
