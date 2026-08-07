import { useRef } from 'react';

import { motion, useTransform } from 'framer-motion';

import { HeroScene } from './components/canvas/HeroScene';
import { ChapterSectionList } from './components/content/ChapterSectionList';
import { FeatureCallouts } from './components/content/FeatureCallouts';
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
            {/* The controller dissolves in-canvas (see DestructedController);
                this wrapper must stay fully opaque so only the controller dims
                and the --bg backdrop behind the transparent canvas never does */}
            <div className={styles.sceneLayer}>
              <HeroScene />
            </div>

            <motion.div style={{ opacity: hudOpacity }} className={styles.hudLayer}>
              <HeroTagline />
              <FeatureCallouts />
              <HeroButtonHotspots />
            </motion.div>
          </div>
        </div>

        <motion.div style={{ opacity: hudOpacity }} className={styles.hudChromeFade}>
          <HeroHudChrome />
        </motion.div>

        <ScrollProgressRail />

        <div className={styles.contentBelow} ref={contentRef}>
          {/* Every section is tagged data-chapter="" so useChapterMeasurement
              maps it onto the global progress model — the docked controller
              and the rail chapter markers key off the same windows */}
          <ChapterSectionList />
        </div>
      </ScrollProgressProvider>
    </div>
  );
}

export default HeroPageManager;
