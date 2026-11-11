import { useRef } from 'react';

import { motion, useTransform } from 'framer-motion';

import { HeroScene } from './components/canvas/HeroScene';
import { FeatureDisplayPanel } from './components/content/FeatureDisplayPanel';
import { HeroButtonHotspots } from './components/content/HeroButtonHotspots';
import { HeroHudChrome } from './components/content/HeroHudChrome';
import { HeroTagline } from './components/content/HeroTagline';
import { ScrollProgressRail } from './components/content/ScrollProgressRail';
import styles from './css/HeroPageManager.module.css';
import { HUD_FADE_END, HUD_FADE_START, heroProgress, useHeroTimeline } from './timeline';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * Top-level composition for the HeroPage.
 *
 * Wires the page's scroll into the Hero timeline module (useHeroTimeline);
 * every component below reads progress, frame conversion and "what's on
 * stage" from that module rather than from props or context.
 */
export function HeroPageManager() {
  const mainRef = useMainScroll();
  const heroSequenceRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useHeroTimeline(mainRef, heroSequenceRef, rootRef);

  const hudOpacity = useTransform(heroProgress, [HUD_FADE_START, HUD_FADE_END], [1, 0]);

  return (
    <div className={styles.heroPage} ref={rootRef}>
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

      <div className={styles.contentBelow}></div>
    </div>
  );
}

export default HeroPageManager;
