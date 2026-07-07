// components/states/CaseScreenLoading.tsx
import React from 'react';

import styles from './css/CaseScreenLoading.module.css';

export const CaseScreenLoading: React.FC = () => (
  <div className={styles.root}>
    <span className={styles.text}>Loading…</span>
  </div>
);
