import { useMemo, useRef } from 'react';

import styles from './css/ScrollProgressRail.module.css';
import {
  usePageProgressStore,
  getActiveRange,
  type ChapterRange,
} from '../../store/pageProgress.Store';
import { SECTIONS } from '../../utils/sections';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

function ratioToScrollTop(container: HTMLElement, ratio: number) {
  const max = container.scrollHeight - container.clientHeight;
  container.scrollTop = ratio * Math.max(0, max);
}

function centerOf(range: ChapterRange) {
  return (range.start + range.end) / 2;
}

/**
 * Visible scroll control for the whole page. Fills with global scroll progress
 * and supports drag-to-scrub across the hero and the deep-dive chapters. Once
 * the chapter sections are measured, each chapter is marked with an accent dot
 * positioned at its progress window; the active chapter's dot glows and the
 * rail glows with the active chapter's accent.
 */
export function ScrollProgressRail() {
  const progress = usePageProgressStore((s) => s.progress);
  const chapters = usePageProgressStore((s) => s.chapters);
  const mainRef = useMainScroll();
  const dragging = useRef(false);

  const activeId = useMemo(
    () => getActiveRange(progress, chapters)?.id ?? null,
    [progress, chapters],
  );

  const markers = useMemo(() => {
    if (chapters.length > 0) return chapters;
    const fallback = SECTIONS.length;
    const width = (1 - 0.3) / fallback;
    return SECTIONS.map((s, i) => ({
      id: s.id,
      start: 0.3 + i * width,
      end: 0.3 + (i + 1) * width,
    }));
  }, [chapters]);

  const activeChapter = SECTIONS.find((s) => s.id === activeId);

  const scrub = (clientY: number) => {
    const el = mainRef.current;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const ratio = bounds.height > 0 ? (clientY - bounds.top) / bounds.height : 0;
    ratioToScrollTop(el, Math.min(1, Math.max(0, ratio)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrub(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    scrub(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={styles.rail}
      style={
        {
          '--accent': activeChapter?.accent ?? '#d0bcff',
        } as React.CSSProperties
      }
      role="scrollbar"
      aria-label="Page progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className={styles.fill} style={{ height: `${progress * 100}%` }} />
      {markers.map((range) => {
        const chapter = SECTIONS.find((s) => s.id === range.id);
        if (!chapter) return null;
        const active = range.id === activeId;
        return (
          <div
            key={range.id}
            className={`${styles.dot}${active ? ` ${styles.dotActive}` : ''}`}
            style={
              {
                '--dot-color': chapter.accent,
                top: `${centerOf(range) * 100}%`,
              } as React.CSSProperties
            }
            title={chapter.headline}
          />
        );
      })}
    </div>
  );
}
