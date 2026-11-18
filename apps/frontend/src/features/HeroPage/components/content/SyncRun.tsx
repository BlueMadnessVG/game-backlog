import { useState, type CSSProperties } from 'react';

import { motion, type Variants } from 'framer-motion';

import styles from './css/SyncRun.module.css';
import { SECTION_SCRIPT } from '../../utils/assistantScript';
import { prefersReducedMotion } from '../../utils/motion';
import { PLATFORM_COLORS } from '../../utils/platformColors';

import { AssistantAnchor } from '@/common/components/layout/Assistant';
import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * "What happens on Sync": the run of one Xbox sync, written as a log. Every
 * step matches the backend (platform.controller.ts POST /sync →
 * PlatformLibrary.link, then the background achievement and cover jobs).
 * Rows type in one after another the first time the log scrolls into view.
 * The empty slot on the left is where the assistant cube docks.
 *
 * Exports:
 *  - SyncRun (default export too).
 */
type Kind = 'done' | 'background' | 'stop';

const GLYPH: Record<Kind, string> = { done: '✓', background: '…', stop: '!' };

const STEPS: { kind: Kind; command: string; note: string }[] = [
  { kind: 'done', command: 'POST /api/v1/xbox/sync', note: 'Body checked against XboxSyncSchema.' },
  {
    kind: 'done',
    command: 'lock sync:xbox:<user>',
    note: 'Postgres advisory lock. A second press gets 409 SYNC_IN_PROGRESS.',
  },
  {
    kind: 'done',
    command: 'link xbox_accounts',
    note: 'XboxAdapter.link stores the xuid and gamertag.',
  },
  {
    kind: 'done',
    command: 'upsert games + user_games',
    note: 'One transaction, keyed on (platform, external_id).',
  },
  {
    kind: 'done',
    command: '← 200 Library synced',
    note: 'The response returns here, with the games count.',
  },
  {
    kind: 'background',
    command: 'achievements · 5 per batch · 500ms',
    note: 'syncAllAchievements keeps running after the response.',
  },
  {
    kind: 'background',
    command: 'covers · IGDB · 4 per 1.1s',
    note: 'Xbox and PlayStation only. An IGDB cover is never overwritten.',
  },
  {
    kind: 'stop',
    command: '429 → stop · Retry-After: 60',
    note: 'A rate-limit or auth error ends the batch run early.',
  },
];

const list: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.12 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -8 },
  shown: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export function SyncRun() {
  const mainRef = useMainScroll();
  const [reduced] = useState(prefersReducedMotion);

  return (
    <section
      className={styles.section}
      aria-labelledby="sync-heading"
      style={{ '--background': PLATFORM_COLORS.xbox } as CSSProperties}
    >
      <AssistantAnchor id="sync" className={styles.slot} {...SECTION_SCRIPT.sync} />

      <div className={styles.copy}>
        <h2 id="sync-heading" className={styles.heading}>
          One press, four jobs
        </h2>
        <p className={styles.note}>
          Press sync and your games are saved right away. Achievements and covers keep filling in
          after the response.
        </p>

        <motion.ol
          className={styles.log}
          variants={list}
          initial={reduced ? false : 'hidden'}
          whileInView="shown"
          viewport={{ root: mainRef, once: true, amount: 0.4 }}
        >
          {STEPS.map((step) => (
            <motion.li
              key={step.command}
              className={styles.step}
              data-kind={step.kind}
              variants={row}
            >
              <span className={styles.glyph} aria-hidden>
                {GLYPH[step.kind]}
              </span>
              <code className={styles.command}>{step.command}</code>
              <span className={styles.stepNote}>{step.note}</span>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}

export default SyncRun;
