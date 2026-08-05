import { create } from 'zustand';

interface HeroPageScrollState {
  progress: number;
  setProgress: (value: number) => void;
}

export const useScrollStore = create<HeroPageScrollState>((set) => ({
  progress: 0,
  setProgress: (value) => set({ progress: value }),
}));
