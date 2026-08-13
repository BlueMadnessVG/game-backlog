import { create } from 'zustand';

/**
 * Minimal zustand store exposing the hero scroll progress as a plain number.
 *
 * This is the non-MotionValue counterpart to ScrollProgressContext: used
 * where a reactive plain number is enough (HUD fades, counters) without the
 * overhead of a framer-motion MotionValue.
 *
 * Exports:
 *  - useScrollStore: { progress, setProgress }.
 */
interface HeroPageScrollState {
  progress: number;
  setProgress: (value: number) => void;
}

export const useScrollStore = create<HeroPageScrollState>((set) => ({
  progress: 0,
  setProgress: (value) => set({ progress: value }),
}));
