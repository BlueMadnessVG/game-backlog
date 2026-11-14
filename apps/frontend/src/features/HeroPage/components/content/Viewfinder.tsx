import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent } from 'react';

import { useMotionValueEvent } from 'framer-motion';

import styles from './css/Viewfinder.module.css';
import {
  heroToPage,
  pageProgress,
  PLATFORM_TIMELINE,
  useHeroWindow,
  useProgressNumber,
} from '../../timeline';
import { PLATFORM_COLORS, type PlatformKey } from '../../utils/platformColors';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * Camera-viewfinder frame around the page: corner brackets, live readouts
 * (frames per second, viewport size, a timecode that runs with scroll) and a
 * tick ruler at the bottom that doubles as the page scrubber.
 *
 * The ruler is a slider: drag it, or focus it and use the arrow, page, home
 * and end keys. Dots on the ruler mark where each platform beat starts.
 *
 * Exports:
 *  - Viewfinder (default export too).
 */
const FILM_SECONDS = 90;
const FILM_FPS = 24;
const KEY_STEP = 0.02;
const KEY_PAGE_STEP = 0.1;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function timecode(progress: number) {
  const total = progress * FILM_SECONDS;
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  const frames = Math.floor((total % 1) * FILM_FPS);
  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

function setScrollRatio(container: HTMLElement, ratio: number) {
  const max = container.scrollHeight - container.clientHeight;
  container.scrollTop = Math.min(1, Math.max(0, ratio)) * Math.max(0, max);
}

export function Viewfinder() {
  const mainRef = useMainScroll();
  const progress = useProgressNumber(pageProgress);
  const heroWindow = useHeroWindow((s) => s.window);

  const rulerRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const sizeRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);

  useMotionValueEvent(pageProgress, 'change', (latest) => {
    if (timeRef.current) timeRef.current.textContent = timecode(latest);
  });

  useEffect(() => {
    if (timeRef.current) timeRef.current.textContent = timecode(pageProgress.get());

    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        const fps = Math.round((frames * 1000) / (now - last));
        if (fpsRef.current) fpsRef.current.textContent = `${pad(Math.min(fps, 99))}fps`;
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      if (sizeRef.current) sizeRef.current.textContent = `${window.innerWidth}×${window.innerHeight}`;
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const markers = useMemo(
    () =>
      (Object.entries(PLATFORM_TIMELINE) as [PlatformKey, [number, number]][]).map(
        ([id, [start]]) => ({ id, at: heroToPage(start, heroWindow) }),
      ),
    [heroWindow],
  );

  const scrubTo = (clientX: number) => {
    const main = mainRef.current;
    const ruler = rulerRef.current;
    if (!main || !ruler) return;
    const rect = ruler.getBoundingClientRect();
    setScrollRatio(main, (clientX - rect.left) / rect.width);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const main = mainRef.current;
    if (!main) return;
    const delta: Record<string, number> = {
      ArrowRight: KEY_STEP,
      ArrowDown: KEY_STEP,
      ArrowLeft: -KEY_STEP,
      ArrowUp: -KEY_STEP,
      PageDown: KEY_PAGE_STEP,
      PageUp: -KEY_PAGE_STEP,
    };
    if (e.key === 'Home') setScrollRatio(main, 0);
    else if (e.key === 'End') setScrollRatio(main, 1);
    else if (e.key in delta) setScrollRatio(main, progress + delta[e.key]);
    else return;
    e.preventDefault();
  };

  return (
    <div className={styles.viewfinder}>
      <span className={`${styles.bracket} ${styles.tl}`} aria-hidden />
      <span className={`${styles.bracket} ${styles.tr}`} aria-hidden />
      <span className={`${styles.bracket} ${styles.bl}`} aria-hidden />
      <span className={`${styles.bracket} ${styles.br}`} aria-hidden />

      <div className={styles.readouts} aria-hidden>
        <span className={styles.readoutGroup}>
          <span ref={fpsRef}>00fps</span>
          <span ref={sizeRef}>0×0</span>
        </span>
        <span className={styles.readoutGroup}>
          <span className={styles.recDot} />
          <span ref={timeRef} className={styles.time}>
            00:00:00
          </span>
        </span>
      </div>

      <div
        ref={rulerRef}
        className={styles.ruler}
        role="slider"
        tabIndex={0}
        aria-label="Page position"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) scrubTo(e.clientX);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {markers.map((m) => (
          <span
            key={m.id}
            className={styles.marker}
            style={{ left: `${m.at * 100}%`, '--marker': PLATFORM_COLORS[m.id] } as CSSProperties}
            title={m.id}
            aria-hidden
          />
        ))}
        <span className={styles.ticks} aria-hidden />
        <span className={styles.indicator} style={{ left: `${progress * 100}%` }} aria-hidden />
      </div>
    </div>
  );
}

export default Viewfinder;
