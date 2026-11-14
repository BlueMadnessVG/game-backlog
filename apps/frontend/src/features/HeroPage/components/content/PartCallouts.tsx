import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { AnimatePresence, motion, useMotionValueEvent, useTransform } from 'framer-motion';

import styles from './css/PartCallouts.module.css';
import {
  useButtonHotspotsStore,
  type HeroButtonKey,
} from '../../store/heroButtonHotspots.Store';
import { at, DISPLAY_TIMELINE, heroProgress } from '../../timeline';
import { getChapterSample } from '../../utils/chapterSamples';
import { PLATFORM_COLORS, type PlatformKey } from '../../utils/platformColors';
import { SECTIONS, type Chapter } from '../../utils/sections';

/**
 * Part callouts for the platform beats, in the manner of an exploded-view
 * diagram: while a platform's corner light is on stage, a dashed leader runs
 * from that light on the cube to a text block on the left or right grid
 * columns (the chapter's `alignment`). The block names the platform and the
 * pipeline part, then explains it and shows a small sample payload.
 *
 * The leader end that touches the cube is read from the hotspots store
 * (ButtonProjector writes it every frame) and applied straight to the SVG, so
 * following the cube costs no React renders.
 *
 * Exports:
 *  - PartCallouts (default export too).
 */
const PLATFORM_BUTTON: Record<PlatformKey, HeroButtonKey> = {
  steam: 'cross',
  xbox: 'triangle',
  playstation: 'square',
  unified: 'circle',
};

const PLATFORM_NAME: Record<PlatformKey, string> = {
  steam: 'Steam',
  xbox: 'Xbox',
  playstation: 'PlayStation',
  unified: 'Unified',
};

function prettyJson(code: string): string {
  try {
    return JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    return code;
  }
}

function CodeSample({ chapter }: { chapter: Chapter }) {
  const { title, code } = getChapterSample(chapter);
  return (
    <figure className={styles.sample}>
      <figcaption className={styles.sampleCaption}>
        <span className={styles.sampleTitle}>{title}</span>
        <span>Sample data, not real</span>
      </figcaption>
      <pre className={styles.code}>
        <code>{prettyJson(code)}</code>
      </pre>
    </figure>
  );
}

export function PartCallouts() {
  const display = useTransform(heroProgress, (h) => at(h).display);
  const [index, setIndex] = useState(0);
  useMotionValueEvent(display, 'change', setIndex);

  const chapter = index > 0 ? SECTIONS.find((c) => c.index === index) : undefined;
  const platform = DISPLAY_TIMELINE.find((d) => d.display === index)?.key;
  const color = platform ? PLATFORM_COLORS[platform] : undefined;

  const dotRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const startRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const start = startRef.current;
    if (!path || !start) return;

    if (!chapter || !platform) {
      path.setAttribute('d', '');
      start.setAttribute('r', '0');
      return;
    }

    const update = () => {
      const dot = dotRef.current;
      const spot = useButtonHotspotsStore.getState().hotspots[PLATFORM_BUTTON[platform]];
      if (!dot || !spot.visible) {
        path.setAttribute('d', '');
        start.setAttribute('r', '0');
        return;
      }
      const rect = dot.getBoundingClientRect();
      path.setAttribute(
        'd',
        `M ${spot.x} ${spot.y} L ${rect.left + rect.width / 2} ${rect.top + rect.height / 2}`,
      );
      start.setAttribute('cx', String(spot.x));
      start.setAttribute('cy', String(spot.y));
      start.setAttribute('r', '3');
    };

    update();
    return useButtonHotspotsStore.subscribe(update);
  }, [chapter, platform]);

  return (
    <>
      <svg
        className={styles.leader}
        style={{ '--leader': color ?? 'transparent' } as CSSProperties}
        aria-hidden
      >
        <path ref={pathRef} className={styles.leaderPath} />
        <circle ref={startRef} className={styles.leaderStart} r="0" />
      </svg>

      <div className={styles.columns}>
        <AnimatePresence mode="wait">
          {chapter && platform && (
            <motion.aside
              key={chapter.id}
              className={`${styles.panel} ${chapter.alignment === 'right' ? styles.right : styles.left}`}
              style={{ '--platform': color } as CSSProperties}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className={styles.tag}>
                <span className={styles.tagText}>
                  {String(chapter.index).padStart(2, '0')} {PLATFORM_NAME[platform]} ·{' '}
                  {chapter.part}
                </span>
                <span className={styles.rule} aria-hidden />
                <span ref={dotRef} className={styles.dot} aria-hidden />
              </div>

              <h2 className={styles.headline}>{chapter.headline}</h2>
              <div className={styles.paragraphs}>
                {chapter.paragraphs.map((paragraph, i) => (
                  <p key={i} className={styles.body}>
                    {paragraph}
                  </p>
                ))}
              </div>
              <CodeSample chapter={chapter} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default PartCallouts;
