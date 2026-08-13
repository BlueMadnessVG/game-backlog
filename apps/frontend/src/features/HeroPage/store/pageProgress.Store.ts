import { create } from 'zustand';

/**
 * Global page-progress store for the hero → chapters handoff.
 *
 * Holds page-relative scroll progress plus the measured hero-end threshold
 * and the live chapter ranges (see useChapterMeasurement). Components read
 * these to know when the docked mini-controller should mount and which
 * chapter is currently in view.
 *
 * Exports:
 *  - usePageProgressStore: zustand store (progress, heroEnd, chapters +
 *    setters).
 *  - getActiveRange(progress, chapters): the ChapterRange covering a given
 *    progress value, or null.
 */
export interface ChapterRange {
  id: string;
  start: number;
  end: number;
}

interface PageProgressState {
  progress: number;
  heroEnd: number;
  chapters: ChapterRange[];
  setProgress: (value: number) => void;
  setHeroEnd: (value: number) => void;
  setChapters: (chapters: ChapterRange[]) => void;
}

export const usePageProgressStore = create<PageProgressState>((set) => ({
  progress: 0,
  heroEnd: 0.3,
  chapters: [],
  setProgress: (value) => set({ progress: value }),
  setHeroEnd: (value) => set({ heroEnd: value }),
  setChapters: (chapters) => set({ chapters }),
}));

export function getActiveRange(
  progress: number,
  chapters: ChapterRange[],
): ChapterRange | null {
  for (const range of chapters) {
    if (progress >= range.start && progress <= range.end) return range;
  }
  return null;
}
