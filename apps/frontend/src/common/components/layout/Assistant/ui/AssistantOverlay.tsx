import { useEffect, useRef, useState } from 'react';

import styles from './css/AssistantOverlay.module.css';
import { useWheelForward } from './useWheelForward';
import { useAssistantStore, type AssistantScreen } from '../store/assistant.Store';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * DOM companion of the 3D cube, mounted once by AssistantHost:
 *  - a focusable button laid over the cube (so it can be reached by keyboard
 *    and clicked), which toggles the speech bubble;
 *  - the speech bubble beside it: the page's current line, or the store's
 *    `hint` when there is none (the AI chat will replace the hint later).
 *    It is a manual popover, so it sits in the top layer above any page.
 *
 * Both follow the cube's projected viewport position, applied straight to the
 * elements — the store updates every frame and React never re-renders for it.
 * While the cube is hidden its button is `inert`, so Tab skips it. The wheel
 * over the (fixed) button is forwarded to the scroller beneath.
 *
 * Exports:
 *  - AssistantOverlay (default export too).
 */
function place(el: HTMLElement, visible: boolean, x: number, y: number) {
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.style.visibility = visible ? 'visible' : 'hidden';
  el.inert = !visible;
}

function placeButton(button: HTMLElement, s: AssistantScreen) {
  button.style.width = `${s.size}px`;
  button.style.height = `${s.size}px`;
  place(button, s.visible, s.x - s.size / 2, s.y - s.size / 2);
}

/** Beside the cube, on whichever side has room. */
function placeBubble(bubble: HTMLElement, s: AssistantScreen) {
  const flip = s.x > window.innerWidth * 0.55;
  bubble.dataset.side = flip ? 'left' : 'right';
  bubble.style.transform = `translate(${flip ? s.x - s.size / 2 : s.x + s.size / 2}px, ${
    s.y - s.size / 2
  }px)`;
  bubble.style.visibility = s.visible ? 'visible' : 'hidden';
}

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

  // Open the bubble's popover once, so it renders in the top layer; its own
  // visibility and opacity do the showing and hiding from then on.
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble || !('showPopover' in bubble)) return;
    bubble.showPopover();
    return () => {
      if (bubble.isConnected) bubble.hidePopover();
    };
  }, []);

  useEffect(() => {
    const apply = (screen: AssistantScreen) => {
      if (buttonRef.current) placeButton(buttonRef.current, screen);
      if (bubbleRef.current) placeBubble(bubbleRef.current, screen);
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
        popover="manual"
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
