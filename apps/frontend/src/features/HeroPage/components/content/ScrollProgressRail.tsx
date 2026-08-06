import { useRef } from 'react';
import type { RefObject } from 'react';

import styles from './css/ScrollProgressRail.module.css';
import { useScrollStore } from '../../store/heroPageScroll.Store';

interface ScrollProgressRailProps {
  containerRef: RefObject<HTMLElement | null>;
}

function ratioToScrollTop(container: HTMLElement, ratio: number) {
  const max = container.scrollHeight - container.clientHeight;
  container.scrollTop = ratio * Math.max(0, max);
}

/**
 * Visible scroll control for the hero. Fills with scroll progress and
 * supports drag-to-scrub. Replaces the (near-invisible) native scrollbar.
 */
export function ScrollProgressRail({ containerRef }: ScrollProgressRailProps) {
  const progress = useScrollStore((state) => state.progress);
  const dragging = useRef(false);

  const scrub = (clientY: number) => {
    const el = containerRef.current;
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
      role="scrollbar"
      aria-label="Scroll progress"
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
    </div>
  );
}
