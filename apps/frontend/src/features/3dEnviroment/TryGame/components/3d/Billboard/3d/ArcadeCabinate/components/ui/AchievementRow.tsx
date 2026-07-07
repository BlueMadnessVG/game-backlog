import styles from './css/AchievementRow.module.css';

import type { Achievement } from '@repo/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementRowProps {
  achievement: Achievement;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUnlockedDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRarity(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined) return '??%';
  return `${percentage.toFixed(1)}%`;
}

function rarityLabel(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined) return 'UNKNOWN';
  if (percentage <= 5) return 'LEGENDARY';
  if (percentage <= 15) return 'RARE';
  if (percentage <= 30) return 'UNCOMMON';
  return 'COMMON';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AchievementRow: React.FC<AchievementRowProps> = ({ achievement }) => {
  const isUnlocked = achievement.achieved;
  const rarity = rarityLabel(achievement.globalPercentage);

  return (
    <div className={`${styles.row} ${isUnlocked ? styles.rowUnlocked : styles.rowLocked}`}>
      {achievement.iconUrl ? (
        <img
          src={isUnlocked ? achievement.iconUrl : (achievement.iconGrayUrl ?? achievement.iconUrl)}
          alt={achievement.name}
          className={`${styles.icon} ${!isUnlocked ? styles.iconLocked : ''}`}
        />
      ) : (
        <div className={`${styles.iconPlaceholder} ${!isUnlocked ? styles.iconLocked : ''}`}>
          {isUnlocked ? '★' : '☆'}
        </div>
      )}

      <div className={styles.info}>
        <span className={`${styles.name} ${!isUnlocked ? styles.nameLocked : ''}`}>
          {achievement.name}
        </span>
        {achievement.description && (
          <span className={styles.description}>{achievement.description}</span>
        )}
        {isUnlocked && achievement.unlockedAt && (
          <span className={styles.unlockedDate}>{formatUnlockedDate(achievement.unlockedAt)}</span>
        )}
      </div>

      <div className={styles.rarityColumn}>
        <span className={`${styles.rarityBadge} ${styles[`rarity${rarity}`]}`}>{rarity}</span>
        <span className={styles.rarityPct}>{formatRarity(achievement.globalPercentage)}</span>
      </div>
    </div>
  );
};
