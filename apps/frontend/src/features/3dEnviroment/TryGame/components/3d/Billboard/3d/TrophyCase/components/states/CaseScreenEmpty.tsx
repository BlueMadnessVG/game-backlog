// components/states/CaseScreenEmpty.tsx
import React from 'react';

import styles from './css/CaseScreenEmpty.module.css';

export const CaseScreenEmpty: React.FC = () => (
  <div className={styles.root}>
    <span className={styles.icon}>🏆</span>
    <span className={styles.text}>No completed games yet</span>
  </div>
);
