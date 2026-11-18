import { useEffect, useRef } from 'react';

import { anchorRegistry, type AnchorOptions } from './registry';
import { releaseAnchor } from '../scene/useAssistantScene';
import { useAssistantStore } from '../store/assistant.Store';

import { useMainScroll } from '@/common/components/layout/MainLayout/MainScrollContext';

/**
 * An empty box that tells the app-wide assistant cube where to sit. The cube
 * centres on the box and matches its height, so the page controls placement
 * and size with ordinary CSS on `className` (grid-column, height, clamp(),
 * container queries, a media query that hides it…). A box that is hidden or
 * has no size is ignored.
 *
 * While docked here the cube says `line` and shows `emotion`. When several
 * anchors are near the scrollport, the highest `priority` wins, then the one
 * nearest the viewport centre. By default an anchor counts while it is within
 * one screen of the scrollport (so the cube doesn't jump to the corner fallback
 * between sections); pass `margin="0px"` to count only while it is on screen.
 *
 * Exports:
 *  - AssistantAnchorProps, AssistantAnchor (default export too).
 */
export interface AssistantAnchorProps extends AnchorOptions {
  /** Unique per page. */
  id: string;
  className?: string;
  /** IntersectionObserver rootMargin for "near the scrollport". Default: one screen. */
  margin?: string;
}

/** Default: anchors this close to the scrollport (above or below) still count as visible. */
const NEAR_MARGIN = '100% 0px';

export function AssistantAnchor({
  id,
  className,
  line = null,
  emotion,
  priority = 0,
  margin = NEAR_MARGIN,
}: AssistantAnchorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mainRef = useMainScroll();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const entry = { id, el, visible: false, line, emotion, priority };
    anchorRegistry.set(entry);
    useAssistantStore.getState().addAnchors(1);
    const observer = new IntersectionObserver(
      ([record]) => {
        entry.visible = record.isIntersecting;
      },
      { root: mainRef.current, rootMargin: margin },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      anchorRegistry.remove(id, el);
      releaseAnchor();
    };
  }, [id, line, emotion, priority, margin, mainRef]);

  return <div ref={ref} className={className} data-assistant-anchor={id} aria-hidden />;
}

export default AssistantAnchor;
