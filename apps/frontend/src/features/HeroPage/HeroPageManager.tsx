import { useRef } from 'react';

import { HeroScene } from './components/canvas/HeroScene';
import HeroHudChrome from './components/content/HeroHudChrome';
import HeroTagline from './components/content/HeroTagline';
import styles from './css/HeroPageManager.module.css';
import { useScrollSync } from './hooks/useScrollSync';
import { ScrollProgressProvider } from './store/ScrollProgressContext';

export function HeroPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useScrollSync(pageRef);

  return (
    <div ref={pageRef} className={styles.heroPage}>
      <ScrollProgressProvider value={scrollYProgress}>
        {/* 3D Scene — fixed behind everything */}
        <HeroTagline />
        <HeroScene />
        <HeroHudChrome />

        <div className={styles.contentOverlay}></div>
      </ScrollProgressProvider>
    </div>
  );
}

export default HeroPage;
