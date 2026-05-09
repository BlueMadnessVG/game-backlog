import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import styles from './css/TimelineEntryContent.module.css';

interface TimelineEntryContentProps {
  name: string;
  unlockedAt: string | null;
  globalPercentage: number | null;
  isUnlocked: boolean;
  isHidden: boolean;
}

function formatUnlockData(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRarityLabel(pct: number): string {
  if (pct < 5) return 'Ultra Rare';
  if (pct < 15) return 'Rare';
  if (pct < 30) return 'Uncommon';
  return 'Common';
}

function TimeLineEntryContent({
  name,
  unlockedAt,
  globalPercentage,
  isUnlocked,
  isHidden,
}: TimelineEntryContentProps) {
  const [isHovered, setIsHovered] = useState(false);

  const displayName = isHidden ? '???' : name;

  return (
    <div
      className={styles.content_root}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Rarity badge — appears on hover */}
      <AnimatePresence>
        {isHovered && globalPercentage !== null && !isHidden && (
          <motion.div
            className={styles.rarity_badge}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <span className={styles.rarity_pct}>{globalPercentage.toFixed(1)}%</span>
            <span className={styles.rarity_label}>{getRarityLabel(globalPercentage)}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name */}
      <p className={styles.content_name} data-hidden={isHidden}>
        {displayName}
      </p>

      {/* Unlock date — only for unlocked achievements */}
      {isUnlocked && unlockedAt && (
        <p className={styles.content_date}>{formatUnlockData(unlockedAt)}</p>
      )}

      {/* Locked label */}
      {!isUnlocked && !isHidden && <p className={styles.content_locked}>Locked</p>}
    </div>
  );
}

export default TimeLineEntryContent;
