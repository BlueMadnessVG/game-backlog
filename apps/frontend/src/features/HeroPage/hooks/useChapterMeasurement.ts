import { useEffect } from 'react';
import type { RefObject } from 'react';

import { usePageProgressStore } from '../store/pageProgress.Store';

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Measures global-progress windows (0..1 of the main scroll container) for
 * the hero→chapters handoff point and every `[data-chapter]` section inside
 * `contentBelow`. Re-measures on resize and whenever the root layout grows
 * (chapters mount in Plan C), so the docked rail and controller stay in sync
 * with the actual DOM.
 */
export function useChapterMeasurement(
  mainRef: RefObject<HTMLElement | null>,
  rootRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const main = mainRef.current;
    const root = rootRef.current;
    if (!main || !root) return;

    const measure = () => {
      const maxScroll = main.scrollHeight - main.clientHeight;
      if (maxScroll <= 0) return;

      const rootTop = root.getBoundingClientRect().top;

      const toProgress = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return {
          start: clamp01((rect.top - rootTop) / maxScroll),
          end: clamp01((rect.bottom - rootTop) / maxScroll),
        };
      };

      const content = contentRef.current;
      if (content) {
        usePageProgressStore.getState().setHeroEnd(toProgress(content).start);
      }

      const ranges = Array.from(
        content?.querySelectorAll<HTMLElement>('[data-chapter]') ?? [],
      )
        .map((el) => {
          const id = el.getAttribute('data-chapter');
          if (!id) return null;
          const { start, end } = toProgress(el);
          return { id, start, end };
        })
        .filter(
          (r): r is { id: string; start: number; end: number } => r !== null,
        );

      usePageProgressStore.getState().setChapters(ranges);
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
  }, [mainRef, rootRef, contentRef]);
}
