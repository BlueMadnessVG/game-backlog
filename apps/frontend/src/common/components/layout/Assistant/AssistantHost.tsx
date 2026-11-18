import { useState } from 'react';

import styles from './css/AssistantHost.module.css';
import { AssistantCanvas } from './scene/AssistantCanvas';
import { isAssistantActive, useAssistantStore } from './store/assistant.Store';
import { AssistantOverlay } from './ui/AssistantOverlay';

/**
 * Mounts the assistant once for the whole app (in MainLayout): a fixed,
 * full-viewport canvas layer behind the page content, plus the DOM overlay
 * (cube button and speech bubble).
 *
 * The canvas is only created once a page first uses the cube (an anchor, a
 * director, an accessory or scene content), so pages without it never open a
 * WebGL context; after that it stays mounted across routes so the scene isn't
 * rebuilt on navigation and the cube can travel between pages.
 *
 * Exports:
 *  - AssistantHost (default export too).
 */
export function AssistantHost() {
  const active = useAssistantStore(isAssistantActive);
  // Latches true the first time a page uses the cube (adjusting state during
  // render is React's recommended alternative to an effect for this).
  const [created, setCreated] = useState(false);
  if (active && !created) setCreated(true);

  return (
    <>
      <div className={styles.layer} aria-hidden>
        {created && <AssistantCanvas />}
      </div>
      <AssistantOverlay />
    </>
  );
}

export default AssistantHost;
