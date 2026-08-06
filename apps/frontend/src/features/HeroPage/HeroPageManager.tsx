import { useRef } from 'react';

import { HeroScene } from './components/canvas/HeroScene';
import { FeatureCallouts } from './components/content/FeatureCallouts';
import { HeroButtonHotspots } from './components/content/HeroButtonHotspots';
import { HeroHudChrome } from './components/content/HeroHudChrome';
import { HeroTagline } from './components/content/HeroTagline';
import { ScrollProgressRail } from './components/content/ScrollProgressRail';
import styles from './css/HeroPageManager.module.css';
import { useScrollSync } from './hooks/useScrollSync';
import { ScrollProgressProvider } from './store/ScrollProgressContext';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

export function HeroPageManager() {
  const mainRef = useMainScroll();
  const heroSequenceRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useScrollSync(mainRef, heroSequenceRef);

  return (
    <div className={styles.heroPage}>
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

        <div className={styles.contentBelow}>
          {/* SyncMatrix, Topology, Footer go here next — normal document
              flow after the hero sequence */}
        </div>
      </ScrollProgressProvider>
    </div>
  );
}

export default HeroPageManager;
