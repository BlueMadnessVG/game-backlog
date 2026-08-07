import type { CSSProperties } from 'react';

import { motion } from 'framer-motion';

import styles from './css/ChapterSection.module.css';
import {
  SYNTHETIC_NOTICE,
  enrichmentConfig,
  mappingRows,
  statsSample,
  steamAchievementBatch,
  userGameRows,
  validatedGame,
} from '../../utils/sampleData';
import { ChapterController } from '../3d/ChapterController';

import type { Chapter } from '../../utils/sections';

interface SamplePanelData {
  title: string;
  code: string;
}

interface SampleEntry {
  title: string;
  code: (chapter: Chapter) => string;
}

const CHAPTER_SAMPLES: Record<string, SampleEntry> = {
  ingest: {
    title: 'providers/steam.provider.ts → achievements.batch[5]',
    code: () => JSON.stringify(steamAchievementBatch, null, 2),
  },
  normalization: {
    title: 'v.parse(GameSchema, rawProviderPayload)',
    code: () => JSON.stringify(validatedGame, null, 2),
  },
  persistence: {
    title: 'db/schema/core.ts — mapping + per-user rows',
    code: () => JSON.stringify([...mappingRows, ...userGameRows], null, 2),
  },
  'unified-read': {
    title: 'GET /api/stats — merged at read time',
    code: () => JSON.stringify(statsSample, null, 2),
  },
  enrichment: {
    title: `igdb.enrich(queue[${enrichmentConfig.batchSize}]) @ ${enrichmentConfig.pauseMs}ms`,
    code: () => JSON.stringify(enrichmentConfig.enrichedRow, null, 2),
  },
  security: {
    title: '.env — server-side only',
    code: (chapter) =>
      (chapter.redacted ?? []).map((key) => `${key}=<REDACTED>`).join('\n'),
  },
};

function getSample(chapter: Chapter): SamplePanelData {
  const entry = CHAPTER_SAMPLES[chapter.id];
  return {
    title: entry.title,
    code: entry.code(chapter),
  };
}

function SamplePanel({ chapter }: { chapter: Chapter }) {
  const { title, code } = getSample(chapter);
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>{title}</span>
        <span className={styles.panelBadge}>SYNTHETIC</span>
      </div>
      <pre className={styles.code}>
        <code>{code}</code>
      </pre>
      <span className={styles.panelNotice}>{SYNTHETIC_NOTICE}</span>
    </div>
  );
}

/**
 * Renders one deep-dive chapter below the hero sequence. Every section is
 * tagged `data-chapter` so `useChapterMeasurement` can map it onto the global
 * progress model — the docked controller and the rail chapter markers key off
 * the same windows. Content is laid out against the chapter accent, with the
 * schema-shaped sample panel on the opposite side (reversed for `right`
 * chapters).
 */
export function ChapterSection({ chapter }: { chapter: Chapter }) {
  const reversed = chapter.alignment === 'right';

  return (
    <motion.section
      className={`${styles.section}${reversed ? ` ${styles.sectionReversed}` : ''}`}
      data-chapter={chapter.id}
      style={{ '--accent': chapter.accent } as CSSProperties}
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <span
        className={styles.watermark}
        aria-hidden="true"
      >
        {String(chapter.index).padStart(2, '0')}
      </span>

      <div className={styles.text}>
        <span className={styles.kicker}>{chapter.kicker}</span>
        <h2 className={styles.headline}>{chapter.headline}</h2>
        <div className={styles.paragraphs}>
          {chapter.paragraphs.map((paragraph, i) => (
            <p key={i} className={styles.body}>
              {paragraph}
            </p>
          ))}
        </div>
        <div className={styles.meta}>
          <span className={styles.tag}>[ {chapter.tag} ]</span>
          {(chapter.redacted ?? []).map((key) => (
            <span key={key} className={styles.redacted}>
              {key} <b>REDACTED</b>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.panelColumn}>
        <div className={styles.hologram}>
          <ChapterController color={chapter.accent} />
        </div>
        <SamplePanel chapter={chapter} />
      </div>
    </motion.section>
  );
}
