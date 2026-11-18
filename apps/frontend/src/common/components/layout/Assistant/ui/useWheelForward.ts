import { useEffect, type RefObject } from 'react';

/**
 * Lets the mouse wheel scroll the page while the cursor is over a fixed,
 * clickable overlay (the cube button, corner-light hotspots, the ruler).
 *
 * A wheel over a `position: fixed` element does not scroll an `overflow`
 * ancestor such as the app's <main>, so those elements opt in with
 * `data-wheel-forward` and this hook scrolls <main> for them. The listener is
 * registered non-passive on the page root (fixed overlays are still DOM
 * descendants, so their events bubble there) so it can preventDefault.
 */
const LINE_HEIGHT = 16;

export function useWheelForward(
  rootRef: RefObject<HTMLElement | null>,
  mainRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      const main = mainRef.current;
      if (!main || !(e.target instanceof Element)) return;
      if (!e.target.closest('[data-wheel-forward]')) return;

      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? LINE_HEIGHT
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? main.clientHeight
            : 1;
      main.scrollBy({ top: e.deltaY * unit });
      e.preventDefault();
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [rootRef, mainRef]);
}
