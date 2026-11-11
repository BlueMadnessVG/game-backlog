import { useEffect, useState, type RefObject } from 'react';

import { motionValue, useMotionValueEvent, useScroll, type MotionValue } from 'framer-motion';
import { create } from 'zustand';

import { clamp01, DEFAULT_HERO_WINDOW, type HeroWindow } from './frames';

/**
 * The only holders of Hero-page scroll progress.
 *
 * Module-level MotionValues rather than React context: the R3F Canvas runs in
 * its own reconciler, and plain modules are readable from both sides —
 * `heroProgress.get()` inside `useFrame`, `useTransform(heroProgress, …)` in
 * DOM components. The Hero page mounts once, so singletons are safe.
 */
export const heroProgress: MotionValue<number> = motionValue(0);
export const pageProgress: MotionValue<number> = motionValue(0);

interface HeroWindowState {
  window: HeroWindow;
  setWindow: (window: HeroWindow) => void;
}

/** The measured hero span in page progress — the one input to the frame conversion. */
export const useHeroWindow = create<HeroWindowState>((set) => ({
  window: DEFAULT_HERO_WINDOW,
  setWindow: (window) => set({ window }),
}));

/**
 * Wires the Hero page's scroll into the timeline. Call once, from the page
 * root: feeds both progress values and keeps the hero window measured.
 */
export function useHeroTimeline(
  mainRef: RefObject<HTMLElement | null>,
  heroRef: RefObject<HTMLElement | null>,
  rootRef: RefObject<HTMLElement | null>,
): void {
  const hero = useScroll({
    container: mainRef,
    target: heroRef,
    offset: ['start start', 'end end'],
  });
  const page = useScroll({ container: mainRef });

  useMotionValueEvent(hero.scrollYProgress, 'change', (latest) => heroProgress.set(latest));
  useMotionValueEvent(page.scrollYProgress, 'change', (latest) => pageProgress.set(latest));

  useEffect(() => {
    const main = mainRef.current;
    const root = rootRef.current;
    const heroEl = heroRef.current;
    if (!main || !root || !heroEl) return;

    const measure = () => {
      const maxScroll = main.scrollHeight - main.clientHeight;
      if (maxScroll <= 0) return;

      const rootTop = root.getBoundingClientRect().top;
      const rect = heroEl.getBoundingClientRect();

      // Matches the hero's 'start start' → 'end end' offsets: progress 1 is
      // when the spacer's bottom meets the container's bottom.
      useHeroWindow.getState().setWindow({
        start: clamp01((rect.top - rootTop) / maxScroll),
        end: clamp01((rect.bottom - rootTop - main.clientHeight) / maxScroll),
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(main);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mainRef, heroRef, rootRef]);
}

/** A MotionValue as a re-rendering number, for DOM that can't bind it directly. */
export function useProgressNumber(value: MotionValue<number>): number {
  const [current, setCurrent] = useState(() => value.get());
  useMotionValueEvent(value, 'change', setCurrent);
  return current;
}
