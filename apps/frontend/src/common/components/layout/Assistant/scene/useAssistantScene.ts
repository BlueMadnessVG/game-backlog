import { useEffect, type ReactNode } from 'react';

import { type AssistantDirector } from './director';
import { isAssistantActive, useAssistantStore } from '../store/assistant.Store';

/**
 * Hooks a page uses to plug into the app-wide assistant (AssistantHost in
 * MainLayout) for as long as the calling component is mounted. Pass stable
 * values (useMemo / useState): a new value re-registers.
 *
 * On unmount each one clears its value — only if it is still the page's own —
 * and once the page no longer uses the cube at all, the cube button and bubble
 * are hidden so nothing stale shows on the next page.
 *
 * Exports:
 *  - useAssistantScene: extra 3D content for the shared canvas.
 *  - useAssistantAccessory: 3D parts rendered inside the cube body.
 *  - useAssistantDirector: per-frame choreography (see director.ts).
 */
function hideIfUnused() {
  const store = useAssistantStore.getState();
  if (isAssistantActive(store)) return;
  store.setScreen({ ...store.screen, visible: false });
  store.say(null);
}

export function useAssistantScene(node: ReactNode): void {
  useEffect(() => {
    useAssistantStore.getState().setScene(node);
    return () => {
      const store = useAssistantStore.getState();
      if (store.scene !== node) return;
      store.setScene(null);
      hideIfUnused();
    };
  }, [node]);
}

export function useAssistantAccessory(node: ReactNode): void {
  useEffect(() => {
    useAssistantStore.getState().setAccessory(node);
    return () => {
      const store = useAssistantStore.getState();
      if (store.accessory !== node) return;
      store.setAccessory(null);
      hideIfUnused();
    };
  }, [node]);
}

export function useAssistantDirector(director: AssistantDirector): void {
  useEffect(() => {
    useAssistantStore.getState().setDirector(director);
    return () => {
      const store = useAssistantStore.getState();
      if (store.director !== director) return;
      store.setDirector(null);
      hideIfUnused();
    };
  }, [director]);
}

/** Used by AssistantAnchor: counts as "the page uses the cube" while mounted. */
export function releaseAnchor(): void {
  useAssistantStore.getState().addAnchors(-1);
  hideIfUnused();
}
