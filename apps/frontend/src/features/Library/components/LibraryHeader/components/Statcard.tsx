import type { ReactNode } from 'react';

import clsx from 'clsx';

import styles from './css/Statcard.module.css';

export type StatAccent = 'neutral' | 'green' | 'violet' | 'magenta';

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  accent: StatAccent;
  isLoading: boolean;
}

const ACCENT_CLASS_NAME: Record<StatAccent, string> = {
  neutral: '',
  green: styles['accent-green'],
  violet: styles['accent-violet'],
  magenta: styles['accent-magenta'],
};

export function StatCard({ label, value, icon, accent, isLoading }: StatCardProps) {
  return (
    <div className={clsx(styles.card, ACCENT_CLASS_NAME[accent])}>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        {isLoading ? (
          <span className={styles.valueSkeleton} aria-hidden="true" />
        ) : (
          <span className={styles.value}>{value}</span>
        )}
      </div>

      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    </div>
  );
}
