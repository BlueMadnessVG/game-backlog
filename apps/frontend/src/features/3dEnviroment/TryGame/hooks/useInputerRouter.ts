import { useEffect, useRef } from 'react';

import type { CameraMode } from '../types/camera';
import type { ArcadeControls, CarControls, InputMode } from '../types/input';

// ── Key maps ──────────────────────────────────────────────────────────────

const CAR_KEY_MAP: Record<string, keyof CarControls> = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'brake',
};

const ARCADE_KEY_MAP: Record<string, keyof ArcadeControls> = {
  ArrowLeft: 'prev',
  ArrowRight: 'next',
  Escape: 'close',
  Enter: 'select',
};

// ── Return type ───────────────────────────────────────────────────────────

export interface InputRouterResult {
  /**
   * Car controls ref — read by useCarPhysics every frame.
   *
   * All fields are FALSE when inputMode is 'arcade', so the car naturally
   * coasts to a stop via friction. The physics engine itself is untouched.
   */
  carControlsRef: React.RefObject<CarControls>;
  /**
   * Arcade controls ref — read by ArcadeScreen for prev/next/close/select.
   *
   * All fields are FALSE when inputMode is 'driving'.
   */
  arcadeControlsRef: React.RefObject<ArcadeControls>;
}

// ── Mutable internal types ────────────────────────────────────────────────

type MutableCarControls = { -readonly [K in keyof CarControls]: CarControls[K] };
type MutableArcadeControls = { -readonly [K in keyof ArcadeControls]: ArcadeControls[K] };

/**
 * Single keyboard listener that routes every key to the correct control
 * surface depending on the current input mode.
 *
 * ── Why a single listener? ────────────────────────────────────────────────
 * Having two separate hooks (useKeyboardControls + a new arcade hook) means
 * both listen to the same events simultaneously.  When the user presses
 * ArrowLeft in arcade mode, the car listener would also try to look up
 * 'ArrowLeft' in CAR_KEY_MAP (undefined, but still a lookup every frame).
 * More importantly: if driving keys and arcade keys ever overlap (e.g. Enter),
 * both listeners would fire at once.  A single router with an explicit mode
 * check is the only safe design.
 *
 * ── How the car stops ─────────────────────────────────────────────────────
 * When mode switches to 'arcade', all car control fields are set to false
 * immediately and stay false for as long as arcade mode is active.
 * The car's existing exponential friction then naturally decelerates it
 * to zero — no special physics change needed.
 *
 * ── How mode is read ──────────────────────────────────────────────────────
 * The hook accepts a modeRef (the same ref that useCameraMode produces).
 * Reading a ref inside an event handler is safe and zero-cost — no
 * re-renders, no stale closures.
 *
 * @param cameraModeRef  The modeRef from useCameraMode — drives input routing.
 */
export function useInputRouter(
  cameraModeRef: React.MutableRefObject<CameraMode>,
): InputRouterResult {
  const carControls = useRef<MutableCarControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  });

  const arcadeControls = useRef<MutableArcadeControls>({
    prev: false,
    next: false,
    close: false,
    select: false,
  });

  useEffect(() => {
    const inputMode = (): InputMode => (cameraModeRef.current === 'arcade' ? 'arcade' : 'driving');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (inputMode() === 'driving') {
        // ── Driving mode: route to car controls ──────────────────────
        const action = CAR_KEY_MAP[e.code];
        if (action) carControls.current[action] = true;
      } else {
        // ── Arcade mode: route to arcade controls ────────────────────
        // Also clear any car keys that might have been held when the
        // mode switched (e.g. player was holding W when they pressed E)
        clearCarControls(carControls.current);

        const action = ARCADE_KEY_MAP[e.code];
        if (action) arcadeControls.current[action] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Key-up is always processed for both maps so held keys don't
      // get stuck if the mode changes between keydown and keyup.
      const carAction = CAR_KEY_MAP[e.code];
      const arcadeAction = ARCADE_KEY_MAP[e.code];
      if (carAction) carControls.current[carAction] = false;
      if (arcadeAction) arcadeControls.current[arcadeAction] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // cameraModeRef is a ref — its identity never changes, safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    carControlsRef: carControls as React.RefObject<CarControls>,
    arcadeControlsRef: arcadeControls as React.RefObject<ArcadeControls>,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Zeros all car control fields — called when switching to arcade mode. */
function clearCarControls(controls: MutableCarControls): void {
  controls.forward = false;
  controls.backward = false;
  controls.left = false;
  controls.right = false;
  controls.brake = false;
}
