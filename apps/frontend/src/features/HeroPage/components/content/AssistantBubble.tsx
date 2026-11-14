import { useEffect, useRef, useState } from 'react';

import styles from './css/AssistantBubble.module.css';
import { useAssistantStore } from '../../store/assistant.Store';
import { IDLE_HINT } from '../../utils/assistantScript';

/**
 * DOM companion of the 3D cube: a focusable button laid over the cube (so the
 * assistant can be reached by keyboard and clicked) and the speech bubble
 * beside it. Both follow the cube's projected viewport position, applied
 * straight to the elements — the store updates every frame and React never
 * re-renders for it.
 *
 * Clicking the cube toggles the bubble. The AI chat will replace the bubble's
 * hint text later.
 *
 * Exports:
 *  - AssistantBubble (default export too).
 */
export function AssistantBubble() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const line = useAssistantStore((s) => s.line);
  const open = useAssistantStore((s) => s.bubbleOpen);
  const toggle = useAssistantStore((s) => s.toggleBubble);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(false), 4000);
    return () => window.clearTimeout(id);
  }, [hint]);

  useEffect(() => {
    const apply = (screen: ReturnType<typeof useAssistantStore.getState>['screen']) => {
      const button = buttonRef.current;
      const bubble = bubbleRef.current;
      if (button) {
        button.style.width = `${screen.size}px`;
        button.style.height = `${screen.size}px`;
        button.style.transform = `translate(${screen.x - screen.size / 2}px, ${screen.y - screen.size / 2}px)`;
        button.style.visibility = screen.visible ? 'visible' : 'hidden';
      }
      if (bubble) {
        const flip = screen.x > window.innerWidth * 0.55;
        bubble.dataset.side = flip ? 'left' : 'right';
        bubble.style.transform = `translate(${
          flip ? screen.x - screen.size / 2 : screen.x + screen.size / 2
        }px, ${screen.y - screen.size / 2}px)`;
        bubble.style.visibility = screen.visible ? 'visible' : 'hidden';
      }
    };
    apply(useAssistantStore.getState().screen);
    return useAssistantStore.subscribe((state, prev) => {
      if (state.screen !== prev.screen) apply(state.screen);
    });
  }, []);

  const shown = line ? open : hint;
  const text = line ?? IDLE_HINT;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.cube}
        aria-label="Assistant"
        aria-expanded={shown}
        onClick={() => (line ? toggle() : setHint((h) => !h))}
      />
      <div
        ref={bubbleRef}
        className={styles.bubble}
        role="status"
        aria-live="polite"
        data-open={shown}
      >
        <p className={styles.text}>{shown ? text : ''}</p>
      </div>
    </>
  );
}

export default AssistantBubble;
