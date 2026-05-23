import { useEffect, useRef } from 'react';

import type { KeyboardControls } from '../types/vehicle';

type MutableKeyboardControls = {
  -readonly [K in keyof KeyboardControls]: KeyboardControls[K];
};

const KEY_MAP: Record<string, keyof KeyboardControls> = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'brake',
};

export const useKeyboardControls = (): React.RefObject<KeyboardControls> => {
  const controls = useRef<MutableKeyboardControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.code];
      if (!action) return;
      controls.current[action] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.code];
      if (!action) return;
      controls.current[action] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return controls;
};
