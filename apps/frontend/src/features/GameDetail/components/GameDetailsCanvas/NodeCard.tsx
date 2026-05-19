import { useEffect, useRef } from 'react';

import type { Achievement } from '@repo/shared';

interface NodeCardProps {
  node: Achievement | null;
  onClose: () => void;
}

const ACHIEVEMENT_STATUS_COLOR = {
  unlocked: '#22c55e',
  locked: '#ef4444',
};

// ============================================================================
// UTILITY - Format unlock date
// ============================================================================

function formatUnlockDate(dateString: string | null): string {
  if (!dateString) return 'LOCKED';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return `${diffDays}D AGO`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}W AGO`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}M AGO`;

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

// ============================================================================
// COMPONENT - Rarity Bar
// ============================================================================

function RarityBar({ percentage }: { percentage: number | null }) {
  if (percentage === null) return <span style={{ color: '#4a5568' }}>N/A</span>;

  const filled = Math.round(percentage / 5);
  return (
    <span style={{ display: 'inline-flex', gap: '1px', alignItems: 'center' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: '3px',
            height: '8px',
            borderRadius: '0.5px',
            backgroundColor: i < filled ? '#e2e8f0' : '#1e2230',
            display: 'inline-block',
          }}
        />
      ))}
      <span style={{ marginLeft: '6px', color: '#e2e8f0', fontSize: '10px' }}>
        {percentage.toFixed(1)}%
      </span>
    </span>
  );
}

// ============================================================================
// COMPONENT - Achievement Node Card
// ============================================================================

export function NodeCard({ node, onClose }: NodeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px) scale(0.97)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });
  }, [node?.id]);

  if (!node) return null;

  const statusColor = node.achieved
    ? ACHIEVEMENT_STATUS_COLOR.unlocked
    : ACHIEVEMENT_STATUS_COLOR.locked;
  const statusLabel = node.achieved ? 'UNLOCKED' : 'LOCKED';
  const unlockedDate = formatUnlockDate(node.achieved ? node.unlockedAt : null);

  return (
    <div>
      {/* Main card */}
      <div
        style={{
          background: 'rgba(13, 15, 20, 0.92)',
          border: `1px solid ${statusColor}44`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Corner brackets */}
        <CornerBracketSVG color={statusColor} />

        {/* Achievement icon / status area */}
        <div
          style={{
            background: '#060810',
            borderBottom: `1px solid ${statusColor}44`,
            padding: '14px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Status indicator */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
              flexShrink: 0,
            }}
          />

          {/* Status text */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '9px',
                color: statusColor,
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              {statusLabel}
            </div>
            <div
              style={{
                fontSize: '9px',
                color: '#64748b',
                marginTop: '2px',
              }}
            >
              {unlockedDate}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              fontSize: '10px',
              color: '#64748b',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              padding: 0,
              fontFamily: 'inherit',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.color = statusColor;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.color = '#64748b';
            }}
          >
            ✕
          </button>
        </div>

        {/* Info rows */}
        <div
          style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          {/* Achievement title */}
          <div>
            <div
              style={{
                fontSize: '12px',
                color: '#e2e8f0',
                fontWeight: 700,
                letterSpacing: '0.03em',
                wordBreak: 'break-word',
                maxHeight: '60px',
                overflow: 'hidden',
              }}
            >
              {node.name}
            </div>
          </div>

          <Divider color={statusColor} />

          {/* Description */}
          {node.description && (
            <>
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    lineHeight: '1.4',
                    maxHeight: '45px',
                    overflow: 'hidden',
                  }}
                >
                  {node.description}
                </div>
              </div>

              <Divider color={statusColor} />
            </>
          )}

          {/* Rarity */}
          <Row label="RARITY">
            <RarityBar percentage={node.globalPercentage} />
          </Row>

          <Divider color={statusColor} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT - Row Helper
// ============================================================================

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '9px', color: '#4a5568', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{children}</div>
    </div>
  );
}

// ============================================================================
// COMPONENT - Divider
// ============================================================================

function Divider({ color }: { color: string }) {
  return (
    <div
      style={{
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${color}44 30%, ${color}44 70%, transparent)`,
      }}
    />
  );
}

// ============================================================================
// COMPONENT - Corner Brackets SVG
// ============================================================================

function CornerBracketSVG({ color }: { color: string }) {
  const sz = 10;
  const stroke = color;
  const strokeOpacity = 0.5;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top-left */}
      <path
        d={`M${sz},2 L2,2 L2,${sz}`}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity={strokeOpacity}
      />
      {/* Top-right */}
      <path
        d={`M calc(100% - ${sz}),2 L calc(100% - 2),2 L calc(100% - 2),${sz}`}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity={strokeOpacity}
      />
      {/* Bottom-left */}
      <path
        d={`M2,calc(100% - ${sz}) L2,calc(100% - 2) L${sz},calc(100% - 2)`}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity={strokeOpacity}
      />
      {/* Bottom-right */}
      <path
        d={`M calc(100% - 2),calc(100% - ${sz}) L calc(100% - 2),calc(100% - 2) L calc(100% - ${sz}),calc(100% - 2)`}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity={strokeOpacity}
      />
    </svg>
  );
}
