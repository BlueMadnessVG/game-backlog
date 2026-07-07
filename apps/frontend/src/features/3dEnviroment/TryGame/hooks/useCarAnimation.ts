import { useEffect, useRef } from 'react';

import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

import type * as THREE from 'three';

// Local threshold matching your system configuration to determine if the asset is dynamic
const STEERING_DEACTIVATION_THRESHOLD = 0.01;

/**
 * SRP: Manages playback state transitions, blending, and
 * time-warping for the vehicle's Skeletal Mesh clips based on physics state.
 */
export function useCarAnimation(
  animations: THREE.AnimationClip[],
  groupRef: React.RefObject<THREE.Group | null>,
  sharedSpeedRef: React.MutableRefObject<number>,
): void {
  const { actions, names } = useAnimations(animations, groupRef);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if (!actions || names.length === 0) return;

    // Index 0 tracks our fallback resting clip (Idle / Suspension Bounce)
    const defaultClip = names[0];
    const initialAction = actions[defaultClip];

    if (initialAction) {
      initialAction.play();
      activeActionRef.current = initialAction;
    }

    return () => {
      if (activeActionRef.current) activeActionRef.current.fadeOut(0.25);
    };
  }, [actions, names]);

  useFrame(() => {
    if (!actions || names.length < 2) return;

    const currentSpeed = Math.abs(sharedSpeedRef.current);
    const isMoving = currentSpeed > STEERING_DEACTIVATION_THRESHOLD;

    // Index 0 = Idle Bounce, Index 1 = Drive/Wheel Spin
    const targetClipName = isMoving ? names[1] : names[0];
    const targetAction = actions[targetClipName];

    // Evaluate state delta: execute smooth crossfade when movement state changes
    if (targetAction && activeActionRef.current && activeActionRef.current !== targetAction) {
      const oldAction = activeActionRef.current;

      targetAction.reset().fadeIn(0.2).play();
      oldAction.fadeOut(0.2);

      activeActionRef.current = targetAction;
    }

    // Dynamic Time Warping: Scale animation speed proportional to vehicle velocity
    if (isMoving && activeActionRef.current) {
      // 0.15 is a tuning scalar to visually align physics speed with wheel-rotation aesthetics
      activeActionRef.current.timeScale = currentSpeed * 0.15;
    } else if (activeActionRef.current) {
      activeActionRef.current.timeScale = 1.0;
    }
  });
}
