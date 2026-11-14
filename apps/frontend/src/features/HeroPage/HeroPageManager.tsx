import { useRef } from 'react';

import { motion, useTransform } from 'framer-motion';

import { HeroScene } from './components/canvas/HeroScene';
import { AssistantBubble } from './components/content/AssistantBubble';
import { CircuitBackdrop } from './components/content/CircuitBackdrop';
import { ClosingCta } from './components/content/ClosingCta';
import { HeroButtonHotspots } from './components/content/HeroButtonHotspots';
import { HeroTitle } from './components/content/HeroTitle';
import { LoadCounter } from './components/content/LoadCounter';
import { PartCallouts } from './components/content/PartCallouts';
import { StockList } from './components/content/StockList';
import { SyncAnatomy } from './components/content/SyncAnatomy';
import { Viewfinder } from './components/content/Viewfinder';
import styles from './css/HeroPageManager.module.css';
import { HUD_FADE_END, HUD_FADE_START, heroProgress, useHeroTimeline } from './timeline';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * Top-level composition for the HeroPage.
 *
 * Wires the page's scroll into the Hero timeline module (useHeroTimeline);
 * every component below reads progress, frame conversion and "what's on
 * stage" from that module rather than from props or context.
 *
 * Layers, back to front: the circuit-board backdrop, the fixed canvas holding the
 * assistant cube (it stays for the whole page), the hero HUD (title, part
 * callouts, button hotspots — faded out as the hero ends), the content that
 * follows the hero, and the viewfinder frame on top.
 */
export function HeroPageManager() {
  const mainRef = useMainScroll();
  const heroSequenceRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useHeroTimeline(mainRef, heroSequenceRef, rootRef);

  const hudOpacity = useTransform(heroProgress, [HUD_FADE_START, HUD_FADE_END], [1, 0]);
  const hudVisibility = useTransform(heroProgress, (p) =>
    p >= HUD_FADE_END ? 'hidden' : 'visible',
  );

  return (
    <div className={styles.heroPage} ref={rootRef}>
      <LoadCounter />
      <CircuitBackdrop />

      <div className={styles.sceneLayer}>
        <HeroScene />
      </div>

      <motion.div
        style={{ opacity: hudOpacity, visibility: hudVisibility }}
        className={styles.hudLayer}
      >
        <HeroTitle />
        <PartCallouts />
        <HeroButtonHotspots />
      </motion.div>

      <AssistantBubble />
      <Viewfinder />

      {/* Empty spacer: its scroll progress drives the hero timeline. */}
      <div className={styles.heroViewport} ref={heroSequenceRef} />

      <div className={styles.contentBelow}>
        <StockList />
        <SyncAnatomy />
        <ClosingCta />
      </div>
    </div>
  );
}

export default HeroPageManager;
