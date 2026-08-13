import { useMemo, useRef } from 'react';

import styles from './css/ScrollProgressRail.module.css';
import { usePageProgressStore, getActiveRange } from '../../store/pageProgress.Store';
import { PLATFORM_COLORS, type PlatformKey } from '../../utils/platformColors';
import { PLATFORM_TIMELINE } from '../../utils/scrollTimeline';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * Visible scroll control for the whole page — the vertical rail on the right
 * edge. Reads global page progress from usePageProgressStore (and the active
 * chapter window) to drive the wave, the platform markers and the scrubber.
 *
 * Exports:
 *  - ScrollProgressRail: renders the rail; drag-to-scrub scrolls the main
 *    container.
 */
const WAVE_LINE_COUNT = 80;

function ratioToScrollTop(container: HTMLElement, ratio: number) {
  const max = container.scrollHeight - container.clientHeight;
  container.scrollTop = ratio * Math.max(0, max);
}

/**
 * Visible scroll control for the whole page. Fills with global scroll progress
 * and supports drag-to-scrub across the hero and the deep-dive chapters. A
 * vertical wave of lines swells into a peak at the current scroll position
 * (mirroring the SidebarWave mountain), tinted with the active platform's
 * accent. Each platform hologram window (PLATFORM_TIMELINE, hero-relative) is
 * mapped into global progress and marked with an accent dot; the active
 * window's dot glows and the rail glows with the active platform's accent.
 */
export function ScrollProgressRail() {
  const progress = usePageProgressStore((s) => s.progress);
  const heroEnd = usePageProgressStore((s) => s.heroEnd);
  const mainRef = useMainScroll();
  const dragging = useRef(false);

  const markers = useMemo(() => {
    const end = heroEnd > 0 ? heroEnd : 0.3;
    return Object.entries(PLATFORM_TIMELINE).map(([id, [start, windowEnd]]) => ({
      id,
      start: start * end,
      end: windowEnd * end,
    }));
  }, [heroEnd]);

  const activeId = useMemo(
    () => getActiveRange(progress, markers)?.id ?? null,
    [progress, markers],
  );

  const activeColor =
    activeId && activeId in PLATFORM_COLORS ? PLATFORM_COLORS[activeId as PlatformKey] : null;

  const waveLines = useMemo(() => {
    const range = 0.12;
    return Array.from({ length: WAVE_LINE_COUNT }, (_, i) => {
      const y = i / (WAVE_LINE_COUNT - 1);
      const dist = Math.abs(progress - y);
      const swell = dist < range ? Math.pow(1 - dist / range, 2.5) * 56 : 0;
      return 3 + swell;
    });
  }, [progress]);

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
          '--accent': activeColor ?? '#d0bcff',
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
      <div className={styles.wave}>
        {waveLines.map((width, i) => (
          <div key={i} className={styles.waveLine} style={{ width: `${width}px` }} />
        ))}
      </div>
      {markers.map((range) => {
        const active = range.id === activeId;
        return (
          <div
            key={range.id}
            className={`${styles.dot}${active ? ` ${styles.dotActive}` : ''}`}
            style={
              {
                '--dot-color': PLATFORM_COLORS[range.id as PlatformKey],
                top: `${range.start * 100}%`,
              } as React.CSSProperties
            }
            title={range.id}
          />
        );
      })}
    </div>
  );
}
