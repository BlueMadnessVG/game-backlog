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

export function HeroPageManager() {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroSequenceRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useScrollSync(pageRef, heroSequenceRef);

  return (
    <div ref={pageRef} className={styles.heroPage}>
      <ScrollProgressProvider value={scrollYProgress}>
        <HeroTagline />
        <FeatureCallouts />
        <HeroScene />
        <HeroHudChrome />
        <HeroButtonHotspots />
        <ScrollProgressRail containerRef={pageRef} />

        <div className={styles.contentOverlay}>
          <div ref={heroSequenceRef} className={styles.heroSequenceSpacer} />
          {/* SyncMatrix, Topology, Footer go here next — normal document
              flow, independent of the progress value driving everything
              above */}
        </div>
      </ScrollProgressProvider>
    </div>
  );
}

export default HeroPageManager;
