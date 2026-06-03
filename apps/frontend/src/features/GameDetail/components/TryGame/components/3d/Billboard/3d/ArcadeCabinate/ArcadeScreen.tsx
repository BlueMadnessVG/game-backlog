// components/3d/Billboard/3d/ArcadeScreen.tsx
/**
 * Screen content rendered inside the arcade cabinet's Html overlay.
 *
 * Three states, each styled to feel like a CRT arcade screen:
 *
 *   IDLE   — cabinet is visible but car is not nearby.
 *            Shows category name + game count in a retro ticker style.
 *
 *   NEARBY — car is within interaction distance but screen not opened.
 *            Animates a game cover carousel with a scanline overlay.
 *
 *   OPEN   — player pressed E / Enter to open the full view.
 *            Cover art large-left, metadata right, nav controls at bottom.
 *
 * All styling is inline so this component has zero external CSS dependencies
 * (the cabinet is visually isolated from the rest of the UI).
 */

import React, { useState, useEffect } from 'react';

import { Html } from '@react-three/drei';

import type { Game } from '@repo/shared';

// ── Shared style tokens ───────────────────────────────────────────────────

/** Orange accent — matches the cabinet trim and proximity glow */
const ACCENT = '#f97316';
const ACCENT_DIM = '#7c3a10';
const SCREEN_BG = '#070d14';
const FONT_RETRO = '"Press Start 2P", "Courier New", monospace';

const scanlineStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
  pointerEvents: 'none',
  zIndex: 10,
};

const screenRoot: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: SCREEN_BG,
  overflow: 'hidden',
  borderRadius: '4px',
  fontFamily: FONT_RETRO,
  color: '#e2e8f0',
};

// ── Props ─────────────────────────────────────────────────────────────────

interface ArcadeScreenProps {
  readonly games: readonly Game[];
  readonly isLoading: boolean;
  readonly isOpen: boolean;
  readonly isSelected: boolean;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

// ── Screen width / height fed in by the parent group ─────────────────────
// The Html overlay is sized by the container below; these control the
// pixel dimensions of the Html element.
const SCREEN_W = 320; // px — tune with SCREEN_OFFSET if it overflows the mesh
const SCREEN_H = 220; // px

// ── Component ─────────────────────────────────────────────────────────────

export const ArcadeScreen: React.FC<ArcadeScreenProps> = ({
  games,
  isLoading,
  isOpen,
  isSelected,
  onOpen,
  onClose,
}) => {
  // Carousel index for the nearby/idle cover rotation
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState(0);

  // Auto-advance carousel when not fully open
  useEffect(() => {
    if (isOpen || games.length <= 1) return;
    const id = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % games.length);
    }, 3000);
    return () => clearInterval(id);
  }, [isOpen, games.length]);

  const activeGame = isOpen ? games[openIndex] : games[carouselIndex];

  return (
    <Html
      transform
      occlude
      style={{ width: SCREEN_W, height: SCREEN_H, pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      <div style={screenRoot}>
        {/* CRT scanline overlay — always on top */}
        <div style={scanlineStyle} />

        {/* ── LOADING ──────────────────────────────────────────────── */}
        {isLoading && (
          <div style={centeredFlex}>
            <span style={{ color: ACCENT, fontSize: '8px', letterSpacing: '2px' }}>LOADING…</span>
          </div>
        )}

        {/* ── IDLE / NEARBY (not open) ─────────────────────────────── */}
        {!isLoading && !isOpen && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top ticker bar */}
            <div style={tickerBar}>
              <span style={tickerText}>▶ NOW PLAYING ◀</span>
            </div>

            {/* Cover carousel — fills remaining height */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {activeGame?.coverUrl ? (
                <img
                  src={activeGame.coverUrl}
                  alt={activeGame.title ?? ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    filter: 'saturate(1.2) contrast(1.05)',
                    // subtle zoom-in animation via CSS transform would need keyframes;
                    // keep static for now — no CSS module dependency
                  }}
                />
              ) : (
                // Placeholder when no cover art available
                <div
                  style={{ ...centeredFlex, background: '#0f172a', width: '100%', height: '100%' }}
                >
                  <span style={{ fontSize: '28px' }}>🎮</span>
                </div>
              )}

              {/* Game title overlay at bottom of cover */}
              <div style={coverTitleOverlay}>
                <span style={{ fontSize: '7px', letterSpacing: '1px', color: '#fff' }}>
                  {activeGame?.title ?? '—'}
                </span>
              </div>

              {/* Carousel dot indicators */}
              {games.length > 1 && (
                <div style={dotRow}>
                  {games.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: i === carouselIndex ? ACCENT : ACCENT_DIM,
                        transition: 'background 0.3s',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bottom: count + open prompt */}
            <div style={bottomBar}>
              <span style={{ color: '#94a3b8', fontSize: '7px' }}>
                {games.length} game{games.length !== 1 ? 's' : ''}
              </span>
              {isSelected && games.length > 0 && (
                <button style={openButton} onClick={onOpen}>
                  [E] OPEN
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── OPEN (full game detail view) ─────────────────────────── */}
        {!isLoading && isOpen && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={headerBar}>
              <span style={{ color: ACCENT, fontSize: '7px', letterSpacing: '1px' }}>
                ▶ NOW PLAYING
              </span>
              <button style={closeBtn} onClick={onClose}>
                ✕
              </button>
            </div>

            {/* Body: cover left + info right */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Cover */}
              <div style={{ width: '45%', position: 'relative', overflow: 'hidden' }}>
                {activeGame?.coverUrl ? (
                  <img
                    src={activeGame.coverUrl}
                    alt={activeGame.title ?? ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div
                    style={{
                      ...centeredFlex,
                      background: '#0f172a',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    <span style={{ fontSize: '22px' }}>🎮</span>
                  </div>
                )}
              </div>

              {/* Info panel */}
              <div style={infoPanel}>
                <span style={{ fontSize: '7px', color: '#e2e8f0', lineHeight: 1.5 }}>
                  {activeGame?.title ?? '—'}
                </span>

                {/* Play time as block segments */}
                {activeGame?.playTime !== undefined && activeGame.playTime > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: '6px',
                        color: '#94a3b8',
                        display: 'block',
                        marginBottom: 3,
                      }}
                    >
                      PLAY TIME
                    </span>
                    <PlayTimeBar hours={Math.round(activeGame.playTime / 60)} />
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            {games.length > 1 && (
              <div style={navBar}>
                <button
                  style={navBtn}
                  onClick={() => setOpenIndex((i) => (i - 1 + games.length) % games.length)}
                >
                  ‹
                </button>
                <span style={{ fontSize: '7px', color: '#94a3b8' }}>
                  {openIndex + 1} / {games.length}
                </span>
                <button style={navBtn} onClick={() => setOpenIndex((i) => (i + 1) % games.length)}>
                  ›
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── EMPTY state ──────────────────────────────────────────── */}
        {!isLoading && games.length === 0 && (
          <div style={centeredFlex}>
            <span style={{ fontSize: '7px', color: '#475569', letterSpacing: '1px' }}>
              NO GAMES YET
            </span>
          </div>
        )}
      </div>
    </Html>
  );
};

// ── Sub-component: play-time block bar ────────────────────────────────────

/**
 * Renders hours as a row of filled/empty block segments — like an old-school
 * health bar. Each block = 10 hours, max 10 blocks shown.
 */
const PlayTimeBar: React.FC<{ hours: number }> = ({ hours }) => {
  const MAX_BLOCKS = 10;
  const PER_BLOCK = 10; // hours per block
  const filled = Math.min(Math.round(hours / PER_BLOCK), MAX_BLOCKS);

  return (
    <div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: MAX_BLOCKS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 6,
              borderRadius: 1,
              background: i < filled ? ACCENT : ACCENT_DIM,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: '6px', color: '#64748b', marginTop: 2, display: 'block' }}>
        {hours} hrs
      </span>
    </div>
  );
};

// ── Style constants ───────────────────────────────────────────────────────

const centeredFlex: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const tickerBar: React.CSSProperties = {
  background: '#0f172a',
  borderBottom: `1px solid ${ACCENT}40`,
  padding: '4px 8px',
  textAlign: 'center',
};

const tickerText: React.CSSProperties = {
  color: ACCENT,
  fontSize: '7px',
  letterSpacing: '2px',
  textShadow: `0 0 6px ${ACCENT}`,
};

const coverTitleOverlay: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
  padding: '8px 6px 4px',
};

const dotRow: React.CSSProperties = {
  position: 'absolute',
  bottom: 22,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 4,
};

const bottomBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 8px',
  background: '#0f172a',
  borderTop: `1px solid ${ACCENT}30`,
};

const openButton: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${ACCENT}`,
  color: ACCENT,
  fontSize: '7px',
  padding: '2px 6px',
  cursor: 'pointer',
  letterSpacing: '1px',
  fontFamily: FONT_RETRO,
};

const headerBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 8px',
  background: '#0f172a',
  borderBottom: `1px solid ${ACCENT}40`,
};

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  fontSize: '10px',
  cursor: 'pointer',
  padding: '0 2px',
};

const infoPanel: React.CSSProperties = {
  flex: 1,
  padding: '8px 6px',
  background: '#0c1420',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const navBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '4px 8px',
  background: '#0f172a',
  borderTop: `1px solid ${ACCENT}30`,
};

const navBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${ACCENT}60`,
  color: ACCENT,
  fontSize: '14px',
  width: '22px',
  height: '22px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'monospace',
};
