import { AchievementRow } from './AchievementRow';
import styles from './css/AchievementList.module.css';
import { useAchievementTimeline } from '../../hooks/useAchivementTimeline';

import type { AchievementFilter, AchievementSort } from '@repo/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementListInnerProps {
  gameId: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const FilterButton: React.FC<{
  label: string;
  value: AchievementFilter;
  current: AchievementFilter;
  onClick: (v: AchievementFilter) => void;
}> = ({ label, value, current, onClick }) => (
  <button
    className={`${styles.filterBtn} ${current === value ? styles.filterBtnActive : ''}`}
    onClick={() => onClick(value)}
  >
    {label}
  </button>
);

const SortButton: React.FC<{
  label: string;
  value: AchievementSort;
  current: AchievementSort;
  onClick: (v: AchievementSort) => void;
}> = ({ label, value, current, onClick }) => (
  <button
    className={`${styles.sortBtn} ${current === value ? styles.sortBtnActive : ''}`}
    onClick={() => onClick(value)}
  >
    {label}
  </button>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const AchievementListInner: React.FC<AchievementListInnerProps> = ({ gameId }) => {
  const {
    filtered,
    total,
    unlocked,
    filter,
    sort,
    setFilter,
    setSort,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isFromCache,
  } = useAchievementTimeline({ gameId });

  const completionPercent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  if (isLoading) {
    return (
      <div className={styles.statusBox}>
        <span className={styles.statusText}>LOADING ACHIEVEMENTS…</span>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className={styles.statusBox}>
        <span className={styles.statusText}>NO ACHIEVEMENTS FOUND</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className={styles.statsRow}>
        <span className={styles.statsText}>
          {unlocked}/{total} UNLOCKED
        </span>
        <span className={styles.statsPct}>{completionPercent}%</span>
        {isFromCache && <span className={styles.cacheTag}>◉ CACHED</span>}
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${completionPercent}%` }} />
      </div>

      {/* ── Filter controls ──────────────────────────────────────────────── */}
      <div className={styles.controlsRow}>
        <div className={styles.filterGroup}>
          <FilterButton label="ALL" value="all" current={filter} onClick={setFilter} />
          <FilterButton label="DONE" value="unlocked" current={filter} onClick={setFilter} />
          <FilterButton label="TODO" value="locked" current={filter} onClick={setFilter} />
        </div>
        <div className={styles.sortGroup}>
          <SortButton label="DATE" value="unlock-date" current={sort} onClick={setSort} />
          <SortButton label="NAME" value="name" current={sort} onClick={setSort} />
          <SortButton label="RARE" value="rarity" current={sort} onClick={setSort} />
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <div className={styles.list}>
        {filtered.map((achievement) => (
          <AchievementRow key={achievement.name ?? achievement.name} achievement={achievement} />
        ))}

        {filtered.length === 0 && (
          <div className={styles.statusBox}>
            <span className={styles.statusText}>NO MATCHES</span>
          </div>
        )}
      </div>

      {/* ── Load more ────────────────────────────────────────────────────── */}
      {hasNextPage && (
        <button
          className={styles.loadMoreBtn}
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'LOADING…' : '▼ LOAD MORE'}
        </button>
      )}
    </div>
  );
};
