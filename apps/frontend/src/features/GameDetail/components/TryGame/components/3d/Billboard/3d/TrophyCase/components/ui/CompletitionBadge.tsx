// components/ui/CompletionBadge.tsx
/**
 * Gold "COMPLETED" badge overlaid on the cover art.
 * Future: accept a completion percentage or star rating prop.
 */
import React from 'react';

import styles from './css/CompletionBadge.module.css';

export const CompletionBadge: React.FC = () => (
  <div className={styles.badge}>
    <span className={styles.icon}>✓</span>
    <span className={styles.label}>Done</span>
  </div>
);
