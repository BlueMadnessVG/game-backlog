import { create } from 'zustand';

export type HeroButtonKey = 'square' | 'triangle' | 'cross' | 'circle';

export interface Hotspot {
  x: number;
  y: number;
  visible: boolean;
}

interface HeroButtonHotspotsState {
  hotspots: Record<HeroButtonKey, Hotspot>;
  glow: Record<HeroButtonKey, boolean>;
  setHotspot: (key: HeroButtonKey, x: number, y: number, visible: boolean) => void;
  setGlow: (key: HeroButtonKey, value: boolean) => void;
}

const HIDDEN: Hotspot = { x: 0, y: 0, visible: false };

export const useButtonHotspotsStore = create<HeroButtonHotspotsState>((set) => ({
  hotspots: {
    square: { ...HIDDEN },
    triangle: { ...HIDDEN },
    cross: { ...HIDDEN },
    circle: { ...HIDDEN },
  },
  glow: {
    square: false,
    triangle: false,
    cross: false,
    circle: false,
  },
  setHotspot: (key, x, y, visible) =>
    set((state) => ({
      hotspots: { ...state.hotspots, [key]: { x, y, visible } },
    })),
  setGlow: (key, value) =>
    set((state) => ({
      glow: { ...state.glow, [key]: value },
    })),
}));
