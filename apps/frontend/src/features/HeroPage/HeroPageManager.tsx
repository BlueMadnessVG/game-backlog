import { useRef } from 'react';

import { HeroScene } from './components/canvas/HeroScene';
import { DockedControllerHud } from './components/content/DockedControllerHud';
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

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

export function HeroPageManager() {
  const mainRef = useMainScroll();
  const heroSequenceRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useScrollSync(mainRef, heroSequenceRef);

  usePageProgress(mainRef);
  useChapterMeasurement(mainRef, rootRef, contentRef);

  return (
    <div className={styles.heroPage} ref={rootRef}>
      <ScrollProgressProvider value={scrollYProgress}>
        <div className={styles.heroViewport} ref={heroSequenceRef}>
          <div className={styles.sceneStage}>
            <HeroScene />
            <HeroTagline />
            <FeatureCallouts />
            <HeroButtonHotspots />
          </div>
        </div>

        <HeroHudChrome />
        <ScrollProgressRail />
        <DockedControllerHud />

        <div className={styles.contentBelow} ref={contentRef}>
          {/* Chapters mount here in Plan C — each tagged data-chapter="" so
              useChapterMeasurement can map them onto the global progress
              model and the docked controller + rail stay in sync */}
        </div>
      </ScrollProgressProvider>
    </div>
  );
}

export default HeroPageManager;
