import { useEffect, type RefObject } from 'react';

/**
 * Lets the mouse wheel scroll the page while the cursor is over a fixed,
 * clickable overlay (the cube button, corner-light hotspots, the ruler).
 *
 * A wheel over a `position: fixed` element does not scroll an `overflow`
 * ancestor, so those elements opt in with `data-wheel-forward` and this hook
 * scrolls for them: the nearest scrollable element underneath the cursor
 * (e.g. a page's own scroll container), else the app's <main>. The listener is
 * registered non-passive on `rootRef` (fixed overlays are still DOM
 * descendants, so their events bubble there) so it can preventDefault.
 *
 * Exports:
 *  - useWheelForward.
 */
const LINE_HEIGHT = 16;

function canScrollY(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el.scrollHeight <= el.clientHeight) return false;
  const { overflowY } = getComputedStyle(el);
  return overflowY === 'auto' || overflowY === 'scroll';
}

/** The nearest vertically scrollable element under (x, y), ignoring `skip`'s subtree. */
function scrollerAt(x: number, y: number, skip: Element): HTMLElement | null {
  for (const hit of document.elementsFromPoint(x, y)) {
    if (skip.contains(hit) || hit.closest('[data-wheel-forward]')) continue;
    for (let el: Element | null = hit; el; el = el.parentElement) {
      if (canScrollY(el)) return el;
    }
    return null;
  }
  return null;
}

export function useWheelForward(
  rootRef: RefObject<HTMLElement | null>,
  mainRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-wheel-forward]')) return;
      const target = scrollerAt(e.clientX, e.clientY, root) ?? mainRef.current;
      if (!target) return;

      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? LINE_HEIGHT
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? target.clientHeight
            : 1;
      target.scrollBy({ top: e.deltaY * unit });
      e.preventDefault();
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [rootRef, mainRef]);
}
