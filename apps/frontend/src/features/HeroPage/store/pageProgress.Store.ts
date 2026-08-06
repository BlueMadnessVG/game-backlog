import { create } from 'zustand';

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
