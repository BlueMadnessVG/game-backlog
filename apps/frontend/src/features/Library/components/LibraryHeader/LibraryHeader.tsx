import type { ReactNode } from 'react';

import { Archive, Medal } from 'lucide-react';

import { CompletionRing } from './components/Completedring';
import { PlatinumBadge } from './components/Platinumbadge';
import { StatCard, type StatAccent } from './components/Statcard';
import styles from './css/LibraryHearder.module.css';
import { useLibraryStats } from './hook/useLibraryStats';

import type { PlatformStats } from '@repo/shared';

// ── Constants ─────────────────────────────────────────────────────────────────

const ICON_SIZE = 28;
const PLATINUM_DIGIT_COUNT = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatCardConfig {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
  accent: StatAccent;
}

// ── Pure Helpers ──────────────────────────────────────────────────────────────

function formatWholePercentage(value: number): string {
  return `${Math.round(value)}%`;
}

function formatPlatinumCount(value: number): string {
  return String(value).padStart(PLATINUM_DIGIT_COUNT, '0');
}

function buildStatCards(total: PlatformStats): StatCardConfig[] {
  return [
    {
      key: 'total-games',
      label: 'Total games',
      value: total.games.toString(),
      icon: <Archive size={ICON_SIZE} strokeWidth={1.5} />,
      accent: 'neutral',
    },
    {
      key: 'overall-completion',
      label: 'Overall completion',
      value: formatWholePercentage(total.completionPercentage),
      icon: <CompletionRing percentage={total.completionPercentage} size={ICON_SIZE} />,
      accent: 'green',
    },
    {
      key: 'achievements',
      label: 'Achievements',
      value: total.achievements.toString(),
      icon: <Medal size={ICON_SIZE} strokeWidth={1.5} />,
      accent: 'violet',
    },
    {
      key: 'platinum',
      label: 'Platinum',
      value: formatPlatinumCount(total.completedGames),
      icon: <PlatinumBadge size={ICON_SIZE} />,
      accent: 'magenta',
    },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryHeader() {
  const { total, isLoading, isError, error, refetch } = useLibraryStats();

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>{error?.message ?? 'Could not load your library stats.'}</p>
        <button type="button" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const cards = buildStatCards(total);

  return (
    <div className={styles.grid} aria-busy={isLoading}>
      {isLoading && <span className={styles.srOnly}>Loading library stats…</span>}
      {cards.map(({ key, ...card }) => (
        <StatCard key={key} {...card} isLoading={isLoading} />
      ))}
    </div>
  );
}
