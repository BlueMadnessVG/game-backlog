// hooks/useTrophyCaseControls.ts
/**
 * Reads arcadeControlsRef on a RAF loop and fires navigation callbacks
 * on the LEADING EDGE of each key press (prevents rapid-fire repeat).
 *
 * Identical pattern to useArcadeScreenControls — extracted into its own
 * file (SRP) so TrophyCase has no dependency on ArcadeCabinet internals.
 */

import { useEffect, useRef } from 'react';

import type { ArcadeControls } from '../../../../../../types/input';

interface UseTrophyCaseControlsOptions {
  arcadeControlsRef?: React.RefObject<ArcadeControls>;
  gamesCount: number;
  isOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function useTrophyCaseControls({
  arcadeControlsRef,
  gamesCount,
  isOpen,
  onPrev,
  onNext,
  onClose,
}: UseTrophyCaseControlsOptions): void {
  const prevRef = useRef<Readonly<ArcadeControls>>({
    prev: false,
    next: false,
    close: false,
    select: false,
  });

  useEffect(() => {
    if (!isOpen || gamesCount === 0 || !arcadeControlsRef) return;

    let rafId: number;

    const tick = () => {
      const curr = arcadeControlsRef.current;
      const prev = prevRef.current;

      if (curr) {
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
