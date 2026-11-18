import { useEffect, useRef, useState } from 'react';

import styles from './css/AssistantOverlay.module.css';
import { useWheelForward } from './useWheelForward';
import { useAssistantStore, type AssistantScreen } from '../store/assistant.Store';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * DOM companion of the 3D cube, mounted once by AssistantHost: a focusable
 * button laid over the cube (so the assistant can be reached by keyboard and
 * clicked) and the speech bubble beside it. Both follow the cube's projected
 * viewport position, applied straight to the elements — the store updates
 * every frame and React never re-renders for it.
 *
 * Clicking the cube toggles the bubble: the page's current line, or the
 * store's `hint` when there is none. The AI chat will replace the hint later.
 * The wheel over the (fixed) cube button is forwarded to the page scroller.
 *
 * Exports:
 *  - AssistantOverlay (default export too).
 */
export function AssistantOverlay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const mainRef = useMainScroll();
  useWheelForward(rootRef, mainRef);

  const line = useAssistantStore((s) => s.line);
  const hint = useAssistantStore((s) => s.hint);
  const open = useAssistantStore((s) => s.bubbleOpen);
  const toggle = useAssistantStore((s) => s.toggleBubble);
  const [hintShown, setHintShown] = useState(false);

  useEffect(() => {
    if (!hintShown) return;
    const id = window.setTimeout(() => setHintShown(false), 4000);
    return () => window.clearTimeout(id);
  }, [hintShown]);

  useEffect(() => {
    const apply = (screen: AssistantScreen) => {
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

  const shown = line ? open : hintShown;
  const text = line ?? hint;

  return (
    <div ref={rootRef} className={styles.overlay}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.cube}
        aria-label="Assistant"
        data-wheel-forward
        aria-expanded={shown}
        onClick={() => (line ? toggle() : setHintShown((h) => !h))}
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
    </div>
  );
}

export default AssistantOverlay;
