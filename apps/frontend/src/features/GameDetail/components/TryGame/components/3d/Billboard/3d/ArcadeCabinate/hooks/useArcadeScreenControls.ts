/**
 * Reads arcadeControlsRef on a RAF loop and fires navigation callbacks
 * on the leading edge of each keypress (false → true transition).
 *
 * SRP: this hook's only job is translating ref state into screen actions.
 *
 * ── Why RAF instead of reacting inside the event handler? ────────────────
 * arcadeControlsRef is written by useInputRouter's keydown handler.
 * ArcadeScreen is a React component — state changes go through setState so
 * the UI re-renders correctly. The bridge is: read the ref every animation
 * frame, call setState when a key transitions false → true.
 *
 * ── Repeat prevention ────────────────────────────────────────────────────
 * Holding a key fires 60×/s without this. We track the previous frame's
 * state per key and only fire on the leading edge.
 *
 * ── Close vs. nav guard ──────────────────────────────────────────────────
 * Navigation (prev/next) is a no-op with a single game, but close must
 * always be reachable regardless of gamesCount.
 */

import { useEffect, useRef } from 'react';

import type { ArcadeControls } from '../../../../../../types/input';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UseArcadeScreenControlsOptions {
  arcadeControlsRef: React.RefObject<ArcadeControls>;
  gamesCount: number;
  isOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_CONTROLS: Readonly<ArcadeControls> = {
  prev: false,
  next: false,
  close: false,
  select: false,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useArcadeScreenControls({
  arcadeControlsRef,
  gamesCount,
  isOpen,
  onPrev,
  onNext,
  onClose,
}: UseArcadeScreenControlsOptions): void {
  const prevFrameRef = useRef<Readonly<ArcadeControls>>(INITIAL_CONTROLS);

  useEffect(() => {
    // Close is always available when open; nav requires more than one game.
    // We still run the loop as long as the screen is open so close works.
    if (!isOpen) return;

    const canNavigate = gamesCount > 1;
    let rafId: number;

    const tick = () => {
      const curr = arcadeControlsRef.current;
      const prev = prevFrameRef.current;

      if (curr) {
        // Leading-edge detection: only fire on false → true transition
        if (canNavigate && curr.prev && !prev.prev) onPrev();
        if (canNavigate && curr.next && !prev.next) onNext();
        if (curr.close && !prev.close) onClose();

        prevFrameRef.current = { ...curr };
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      // Reset tracked state so stale presses don't fire when re-opening
      prevFrameRef.current = INITIAL_CONTROLS;
    };
  }, [arcadeControlsRef, gamesCount, isOpen, onPrev, onNext, onClose]);
}
