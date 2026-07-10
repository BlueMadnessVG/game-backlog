import { useState } from 'react';

import { useParams } from '@tanstack/react-router';

import { AchievementList } from './components/AchievementList/AchievementList';
import styles from './css/GameDetails.module.css';
import { useGameDetail } from './hooks/useGameDetail';

import type { Game } from '@repo/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'info' | 'achievements';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLastPlayed(isoDate: string | null | undefined): string {
  if (!isoDate) return 'NEVER';
  const date = new Date(isoDate);
  return date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

function formatPlayTime(minutes: number | undefined): string {
  if (!minutes || minutes === 0) return '0H';
  const hours = Math.round(minutes / 60);
  return `${hours}H`;
}

function formatCompletionPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '—';
  return `${pct.toFixed(1)}%`;
}

function platformLabel(platform: string | undefined): string {
  if (!platform) return '—';
  return platform.toUpperCase();
}

function statusLabel(status: string | undefined): string {
  if (!status) return '—';
  const MAP: Record<string, string> = {
    backlog: 'BACKLOG',
    playing: 'PLAYING',
    completed: 'DONE',
    dropped: 'DROPPED',
    wishlist: 'WISHLIST',
  };
  return MAP[status] ?? status.toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

const GameCover: React.FC<{ game: Game | undefined }> = ({ game }) => {
  if (game?.coverUrl) {
    return <img src={game.coverUrl} alt={game.title ?? ''} className={styles.coverImage} />;
  }

  return (
    <div className={styles.coverPlaceholder}>
      <span className={styles.coverPlaceholderEmoji}>🎮</span>
    </div>
  );
};

const StatRow: React.FC<{ label: string; value: string; accent?: boolean }> = ({
  label,
  value,
  accent = false,
}) => (
  <div className={styles.statRow}>
    <span className={styles.statLabel}>{label}</span>
    <span className={`${styles.statValue} ${accent ? styles.statValueAccent : ''}`}>{value}</span>
  </div>
);

const TabButton: React.FC<{
  label: string;
  tab: ActiveTab;
  current: ActiveTab;
  onClick: (t: ActiveTab) => void;
}> = ({ label, tab, current, onClick }) => (
  <button
    className={`${styles.tabBtn} ${current === tab ? styles.tabBtnActive : ''}`}
    onClick={() => onClick(tab)}
  >
    {label}
  </button>
);

// ── Main Component ────────────────────────────────────────────────────────────

// eslint-disable-next-line complexity
function GameDetailManager() {
  const { id } = useParams({ from: '/games/$id' });

  const [activeTab, setActiveTab] = useState<ActiveTab>('info');
  const { game: activeGame, isLoading, isError, queryClient } = useGameDetail({ gameId: id });

  if (isLoading) {
    return <div className={styles.viewContainer}>Loading…</div>;
  }

  if (isError || !activeGame) {
    return <div className={styles.viewContainer}>Game not found.</div>;
  }

  return (
    <div className={styles.screenRoot}>
      <div className={styles.scanlineStyle} />
      <div className={styles.viewContainer}>
        {/* ── Header ─────────────────────────────────────────────────────── */}

        {/* ── Game Cover + Title ─────────────────────────────────────────── */}
        <div className={styles.heroSection}>
          <div className={styles.coverWrapper}>
            <GameCover game={activeGame} />
            {activeGame?.iconUrl && (
              <img src={activeGame.iconUrl} alt="" className={styles.iconBadge} />
            )}
          </div>

          <div className={styles.heroInfo}>
            <span className={styles.heroTitle}>{activeGame?.title ?? '—'}</span>
            <span className={styles.heroPlatform}>{platformLabel(activeGame?.platform)}</span>

            <div className={styles.statusPill}>
              <span
                className={`${styles.statusDot} ${styles[`status_${activeGame?.status ?? 'backlog'}`]}`}
              />
              <span className={styles.statusText}>{statusLabel(activeGame?.status)}</span>
            </div>

            {activeGame?.completionPercentage !== undefined &&
              activeGame.completionPercentage !== null && (
                <div className={styles.completionRow}>
                  <span className={styles.completionLabel}>COMPLETION</span>
                  <span className={styles.completionValue}>
                    {formatCompletionPercent(activeGame.completionPercentage)}
                  </span>
                  <div className={styles.completionTrack}>
                    <div
                      className={styles.completionFill}
                      style={{ width: `${Math.min(activeGame.completionPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className={styles.tabBar}>
          <TabButton label="INFO" tab="info" current={activeTab} onClick={setActiveTab} />
          {activeGame?.id && (
            <TabButton
              label="ACHIEVEMENTS"
              tab="achievements"
              current={activeTab}
              onClick={setActiveTab}
            />
          )}
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────── */}
        <div className={styles.tabContent}>
          {activeTab === 'info' && (
            <div className={styles.infoPanel}>
              <StatRow label="PLAY TIME" value={formatPlayTime(activeGame?.playTime)} accent />
              <StatRow label="LAST PLAYED" value={formatLastPlayed(activeGame?.lastPlayedAt)} />
              <StatRow label="PLATFORM" value={platformLabel(activeGame?.platform)} />
              <StatRow label="STATUS" value={statusLabel(activeGame?.status)} />
            </div>
          )}

          {activeTab === 'achievements' && activeGame?.id && (
            <AchievementList gameId={activeGame.id} queryClient={queryClient} />
          )}
        </div>

        {/* ── Nav Bar ────────────────────────────────────────────────────── */}
      </div>
    </div>
  );
}

export default GameDetailManager;
