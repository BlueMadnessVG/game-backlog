import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

import styles from './css/TimeLineHeader.module.css';

import type { AchievementFilter, AchievementSort } from '@repo/shared';

interface TimelineHeaderProps {
  total: number;
  unlocked: number;
  filter: AchievementFilter;
  sort: AchievementSort;
  isSyncing: boolean;
  onFilterChange: (filter: AchievementFilter) => void;
  onSortChange: (sort: AchievementSort) => void;
  onSync: () => void;
}

const FILTERS: { value: AchievementFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unlocked', label: 'Unlocked' },
  { value: 'locked', label: 'Locked' },
];

const SORTS: { value: AchievementSort; label: string }[] = [
  { value: 'unlock-date', label: 'Date' },
  { value: 'name', label: 'Name' },
  { value: 'rarity', label: 'Rarity' },
];

function TimeLineHeader({
  total,
  unlocked,
  filter,
  sort,
  isSyncing,
  onFilterChange,
  onSortChange,
  onSync,
}: TimelineHeaderProps) {
  return (
    <div className={styles.header_root}>
      {/* Left — counts */}
      <div className={styles.header_counts}>
        <span className={styles.count_unlocked}>{unlocked}</span>
        <span className={styles.count_separator}>/</span>
        <span className={styles.count_total}>{total}</span>
        <span className={styles.count_label}>achievements</span>
      </div>

      {/* Center — filter pills */}
      <div className={styles.filter_group}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={styles.filter_pill}
            data-active={filter === f.value}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Center right — sort pills */}
      <div className={styles.sort_group}>
        {SORTS.map((s) => (
          <button
            key={s.value}
            className={styles.sort_pill}
            data-active={sort === s.value}
            onClick={() => onSortChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Right — sync button */}
      <button className={styles.sync_button} onClick={() => onSync()} disabled={isSyncing}>
        <motion.span
          animate={{ rotate: isSyncing ? 360 : 0 }}
          transition={{
            duration: 1,
            ease: 'linear',
            repeat: isSyncing ? Infinity : 0,
          }}
        >
          <RefreshCw size={12} />
        </motion.span>
        {isSyncing ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  );
}

export default TimeLineHeader;
