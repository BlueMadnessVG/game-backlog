import { create } from 'zustand';

/**
 * Tracks the live screen-space positions and glow state of the four
 * controller face buttons.
 *
 * The 3D controller writes real projected positions into `hotspots` each
 * frame; the DOM overlay reads them to place clickable hot spots over the
 * rendered buttons. `glow` flags which button is currently highlighted by the
 * docked mini-controller / chapter accents.
 *
 * Exports:
 *  - HeroButtonKey: 'square' | 'triangle' | 'cross' | 'circle'.
 *  - Hotspot: { x, y, visible }.
 *  - useButtonHotspotsStore: zustand store (hotspots + glow + setters).
 */
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
