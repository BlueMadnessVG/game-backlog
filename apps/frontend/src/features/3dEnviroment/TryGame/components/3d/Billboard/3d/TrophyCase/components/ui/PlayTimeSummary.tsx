// components/ui/PlayTimeSummary.tsx
import React from 'react';

import styles from './css/PlayTimeSummary.module.css';

interface PlayTimeSummaryProps {
  /** Raw play time in seconds (from Game.playTime). */
  playTime?: number;
}

export const PlayTimeSummary: React.FC<PlayTimeSummaryProps> = ({ playTime }) => {
  if (!playTime || playTime === 0) return null;

  const hours = Math.round(playTime / 60);

  return (
    <div className={styles.root}>
      <span className={styles.label}>PLAY TIME</span>
      <span className={styles.value}>{hours} hrs</span>
    </div>
  );
};
