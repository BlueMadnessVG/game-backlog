import { motion } from 'framer-motion';
import { RefreshCw, Trophy } from 'lucide-react';

import styles from './css/TimelineEmpty.module.css';

import type { AchievementFilter } from '@repo/shared';

interface TimelineEmptyProps {
  filter: AchievementFilter;
  isSyncing: boolean;
  onSync: () => void;
}

const MESSAGES: Record<AchievementFilter, { title: string; body: string }> = {
  all: {
    title: 'No achievements yet',
    body: 'Sync your Steam data to load achievements for this game.',
  },
  unlocked: {
    title: 'None unlocked yet',
    body: 'Keep playing — your unlocked achievements will appear here.',
  },
  locked: {
    title: 'All achievements done',
    body: "You've unlocked everything. Nothing left to chase.",
  },
};

function TimeLineEmpty({ filter, isSyncing, onSync }: TimelineEmptyProps) {
  const { title, body } = MESSAGES[filter];

  return (
    <motion.div
      className={styles.empty_root}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Trophy className={styles.empty_icon} strokeWidth={1} />
      <p className={styles.empty_title}>{title}</p>
      <p className={styles.empty_body}>{body}</p>

      {filter === 'all' && (
        <button className={styles.empty_sync} onClick={() => onSync()} disabled={isSyncing}>
          <motion.span
            animate={{ rotate: isSyncing ? 360 : 0 }}
            transition={{ duration: 1, ease: 'linear', repeat: isSyncing ? Infinity : 0 }}
          >
            <RefreshCw size={12} />
          </motion.span>
          {isSyncing ? 'Syncing...' : 'Sync Steam data'}
        </button>
      )}
    </motion.div>
  );
}

export default TimeLineEmpty;
