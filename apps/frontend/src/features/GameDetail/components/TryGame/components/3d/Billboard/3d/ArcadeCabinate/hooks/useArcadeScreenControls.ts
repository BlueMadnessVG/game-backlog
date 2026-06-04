/**
 * Reads the arcadeControlsRef on a RAF loop and fires navigation callbacks.
 *
 * SRP: this hook's only job is translating ref state into screen actions.
 * It lives next to ArcadeScreen rather than in /hooks because it is
 * exclusively an implementation detail of that component.
 *
 * ── Why RAF instead of reacting inside the event handler? ────────────────
 * arcadeControlsRef is written by useInputRouter's keydown handler.
 * ArcadeScreen is a React component — we want state changes (selected index)
 * to go through React's setState so the UI re-renders correctly.
 * The bridge is: read the ref on every animation frame, call setState when
 * a key transitions from false → true (leading edge only).
 *
 * ── Repeat prevention ────────────────────────────────────────────────────
 * Holding ArrowRight should advance ONE game per keypress, not fire 60×/s.
 * We track 'was pressed last frame' per key and only fire on the leading edge.
 */

import { useEffect, useRef } from 'react';

import type { ArcadeControls } from '../../../../../../types/input';

interface ArcadeScreenControlsOptions {
  arcadeControlsRef: React.RefObject<ArcadeControls>;
  gamesCount: number;
  isOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function useArcadeScreenControls({
  arcadeControlsRef,
  gamesCount,
  isOpen,
  onPrev,
  onNext,
  onClose,
}: ArcadeScreenControlsOptions): void {
  // Track previous frame's key state to detect leading edges
  const prevRef = useRef<Readonly<ArcadeControls>>({
    prev: false,
    next: false,
    close: false,
    select: false,
  });

  useEffect(() => {
    if (!isOpen || gamesCount === 0) return;

    let rafId: number;

    const tick = () => {
      const curr = arcadeControlsRef.current;
      const prev = prevRef.current;

      if (curr) {
        // Leading edge: key was up last frame, down this frame
        if (curr.prev && !prev.prev) onPrev();
        if (curr.next && !prev.next) onNext();
        if (curr.close && !prev.close) onClose();

        prevRef.current = { ...curr };
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [arcadeControlsRef, gamesCount, isOpen, onPrev, onNext, onClose]);
}
