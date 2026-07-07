// components/states/CaseScreenOpen.tsx
import React from 'react';

/* 
import { CompletionBadge } from '../ui/CompletitionBadge';
import { PlayTimeSummary } from '../ui/PlayTimeSummary'; */
import styles from './css/CaseScreenOpen.module.css';

import type { Game } from '@repo/shared';

interface CaseScreenOpenProps {
  activeGame: Game | undefined;
  gamesCount: number;
  openIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/*   activeGame,
  gamesCount,
  openIndex,
  onPrev,
  onNext,
  onClose, */

export const CaseScreenOpen: React.FC<CaseScreenOpenProps> = () => (
  <div className={styles.root}>Screen</div>
);
