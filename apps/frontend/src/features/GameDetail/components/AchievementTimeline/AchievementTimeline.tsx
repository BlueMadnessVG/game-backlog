import { useRef } from 'react';

import TimeLineEmpty from './components/TimeLineEmpty/TimeLineEmpty';
import TimeLineEntry from './components/TimeLineEntry/TimeLineEntry';
import TimeLineHeader from './components/TimeLineHeader/TimeLineHeader';
import styles from './css/AchievementTimeline.module.css';
import { useAchievementTimeline } from './hooks/useAchievementTimeline';

import type { Achievement } from '@repo/shared';

import { groupByMonth } from '@/common/utils/Formatting/groupByMonth';

interface AchievementTimelineProps {
  gameId: string;
}

function AchievementTimeline({ gameId }: AchievementTimelineProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    filtered,
    total,
    unlocked,
    isLoading,
    isSyncing,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    filter,
    sort,
    setFilter,
    setSort,
    sync,
  } = useAchievementTimeline({ gameId });

  const groups = groupByMonth(filtered);

  if (isLoading) return null;

  if (!filtered.length) {
    return (
      <div className={styles.timeline_root}>
        <TimeLineHeader
          total={total}
          unlocked={unlocked}
          filter={filter}
          sort={sort}
          isSyncing={isSyncing}
          onFilterChange={setFilter}
          onSortChange={setSort}
          onSync={sync}
        />
        <TimeLineEmpty filter={filter} onSync={sync} isSyncing={isSyncing} />
      </div>
    );
  }

  return (
    <div className={styles.timeline_root}>
      <TimeLineHeader
        total={total}
        unlocked={unlocked}
        filter={filter}
        sort={sort}
        isSyncing={isSyncing}
        onFilterChange={setFilter}
        onSortChange={setSort}
        onSync={sync}
      />

      <div className={styles.month_labels_track}>
        {groups.map((group) => (
          <div key={group.label} className={styles.month_label} style={{ width: group.trackWidth }}>
            {group.label}
          </div>
        ))}
      </div>

      <div
        ref={scrollRef}
        className={styles.cards_track}
        onScroll={() => {
          if (!scrollRef.current) return;
          const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
          const nearEnd = scrollWidth - scrollLeft - clientWidth < 200;
          if (nearEnd && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
      >
        {groups.map((group) =>
          group.achievements.map((achievement: Achievement, index: number) => (
            <TimeLineEntry key={achievement.id} achievement={achievement} index={index} />
          )),
        )}

        {isFetchingNextPage && (
          <div className={styles.loading_more}>
            <span className={styles.loading_dot} />
            <span className={styles.loading_dot} />
            <span className={styles.loading_dot} />
          </div>
        )}
      </div>
    </div>
  );
}

export default AchievementTimeline;
