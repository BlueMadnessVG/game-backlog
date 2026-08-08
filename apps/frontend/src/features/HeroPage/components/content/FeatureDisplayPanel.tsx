import { useState, type CSSProperties } from 'react';

import { AnimatePresence, motion, useMotionValueEvent, useTransform } from 'framer-motion';
import { Cable, Database, Library, ScanSearch, type LucideIcon } from 'lucide-react';

import styles from './css/FeatureDisplayPanel.module.css';
import { useScrollProgressValue } from '../../store/ScrollProgressContext';
import { getChapterSample } from '../../utils/chapterSamples';
import { activeDisplayIndex } from '../../utils/scrollTimeline';
import { SECTIONS, type Chapter } from '../../utils/sections';

const CONNECT_PATH = 'M 6.5 9 V 2 L 5 2 M 22 9 V 2 M 40 9 V 2';

const CHAPTER_ICONS: Record<Chapter['id'], LucideIcon> = {
  ingest: Cable,
  normalization: ScanSearch,
  persistence: Database,
  'unified-read': Library,
  enrichment: Cable,
  security: Cable,
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
    <div className={styles.codePanel}>
      <div className={styles.codeHeader}>
        <span className={styles.codeTitle}>{title}</span>
        <span className={styles.codeBadge}>SYNTHETIC</span>
      </div>
      <pre className={styles.code}>
        <code>{prettyJson(code)}</code>
      </pre>
    </div>
  );
}

export function FeatureDisplayPanel() {
  const progress = useScrollProgressValue();
  const display = useTransform(progress, activeDisplayIndex);

  const [index, setIndex] = useState(0);
  useMotionValueEvent(display, 'change', setIndex);

  const chapter = index > 0 ? SECTIONS.find((c) => c.index === index) : undefined;
  const Icon = chapter ? CHAPTER_ICONS[chapter.id] : Cable;

  return (
    <>
      <svg
        className={styles.connectTrace}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path className={styles.connectPath} d={CONNECT_PATH} />
      </svg>
      <span className={styles.connectNode} aria-hidden />
      <AnimatePresence>
        {chapter && (
          <motion.aside
            key={chapter.id}
            className={styles.panel}
            style={{ '--accent': chapter.accent } as CSSProperties}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className={styles.display}>
              <div className={styles.indexPlate}>
                <span className={styles.indexPlateNumber}>
                  {String(chapter.index).padStart(2, '0')}
                </span>
              </div>

              <div className={styles.content}>
                <div className={styles.content_text}>
                  <span className={styles.eyebrow}>
                    <Icon size={15} strokeWidth={1.75} />
                    {chapter.kicker}
                  </span>
                  <h2 className={styles.headline}>{chapter.headline}</h2>
                  <div className={styles.paragraphs}>
                    {chapter.paragraphs.map((paragraph, i) => (
                      <p key={i} className={styles.body}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <CodeSample chapter={chapter} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default FeatureDisplayPanel;
