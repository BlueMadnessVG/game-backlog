import { lazy, Suspense, useEffect, useState } from 'react';

import styles from './css/AssistantHost.module.css';
import { isAssistantActive, useAssistantStore } from './store/assistant.Store';
import { AssistantOverlay } from './ui/AssistantOverlay';
import { subscribeReducedMotion } from './utils/motion';

/**
 * Mounts the assistant once for the whole app (in MainLayout): a fixed,
 * full-viewport canvas layer behind the page content, plus the DOM overlay
 * (cube button, pause control and speech bubble).
 *
 * The canvas — and with it three.js, R3F and the cube model — is loaded
 * lazily the first time a page uses the cube (an anchor, a director, an
 * accessory or scene content), so pages without it neither download the 3D
 * code nor open a WebGL context. After that it stays mounted across routes,
 * so the scene isn't rebuilt on navigation and the cube can travel between
 * pages. (Hidden tabs need no handling: the browser stops animation frames.)
 *
 * It also keeps the store's `reducedMotion` in sync with the OS setting, live.
 *
 * Exports:
 *  - AssistantHost (default export too).
 */
const AssistantCanvas = lazy(() => import('./scene/AssistantCanvas'));

export function AssistantHost() {
  const active = useAssistantStore(isAssistantActive);
  // Latches true the first time a page uses the cube (adjusting state during
  // render is React's recommended alternative to an effect for this).
  const [created, setCreated] = useState(false);
  if (active && !created) setCreated(true);

  useEffect(
    () =>
      subscribeReducedMotion((reduced) => useAssistantStore.getState().setReducedMotion(reduced)),
    [],
  );

  return (
    <>
      <div className={styles.layer} aria-hidden>
        {created && (
          <Suspense fallback={null}>
            <AssistantCanvas />
          </Suspense>
        )}
      </div>
      <AssistantOverlay />
    </>
  );
}

export default AssistantHost;
