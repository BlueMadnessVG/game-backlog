import styles from './css/GameDetailHeroStats.module.css';

import type { GameStatus } from '@repo/shared';

import { formatPlayTime } from '@/common/utils/Formatting/formatPlayTime.utils';

interface GameDetailHeroStatsProps {
  playTime: number;
  lastPlayedAt: string | null;
  status: GameStatus;
}

const STATUS_LABEL: Record<GameStatus, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  completed: 'Completed',
  retired: 'Retired',
};

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function GameDetailHeroStats({ playTime, lastPlayedAt, status }: GameDetailHeroStatsProps) {
  return (
    <div className={styles.stats_root}>
      <div className={styles.stat}>
        <span className={styles.stat_label}>Playtime</span>
        <span className={styles.stat_value}>{formatPlayTime(playTime)}</span>
      </div>

      {lastPlayedAt && (
        <div className={styles.stat}>
          <span className={styles.stat_label}>Last Played</span>
          <span className={styles.stat_value}>{formatRelativeTime(lastPlayedAt)}</span>
        </div>
      )}

      <div className={styles.stat}>
        <span className={styles.stat_label}>Status</span>
        <span className={styles.stat_value} data-status={status}>
          {STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}

export default GameDetailHeroStats;
