import type { AnchorEntry } from './registry';
import type { Emotion } from '../store/assistant.Store';

/**
 * Pure helpers for docking the cube to an anchor.
 *
 * Exports:
 *  - AnchorTarget: the chosen anchor, as a viewport target.
 *  - selectAnchor: picks the anchor the cube should dock to.
 *  - pxToScale: converts a box height in px to the cube's world scale.
 */
export interface AnchorTarget {
  id: string;
  /** Box centre in NDC (-1..1, y up). */
  x: number;
  y: number;
  /** Box height in viewport pixels: the cube's on-screen size. */
  heightPx: number;
  line: string | null;
  emotion: Emotion;
}

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

/**
 * Among visible anchors with a box, the one with the highest priority, then
 * the one whose centre is nearest the viewport's vertical centre. Only
 * visible anchors are measured. Null when none qualifies.
 */
export function selectAnchor(
  anchors: Iterable<AnchorEntry>,
  viewport: { width: number; height: number },
  measure: (el: HTMLElement) => Rect = (el) => el.getBoundingClientRect(),
): AnchorTarget | null {
  let best: { entry: AnchorEntry; rect: Rect; priority: number; dist: number } | null = null;

  for (const entry of anchors) {
    if (!entry.visible) continue;
    const rect = measure(entry.el);
    if (rect.width === 0 || rect.height === 0) continue;
    const priority = entry.priority ?? 0;
    const dist = Math.abs(rect.top + rect.height / 2 - viewport.height / 2);
    if (best && (priority < best.priority || (priority === best.priority && dist >= best.dist))) {
      continue;
    }
    best = { entry, rect, priority, dist };
  }
  if (!best) return null;

  const { entry, rect } = best;
  return {
    id: entry.id,
    x: ((rect.left + rect.width / 2) / viewport.width) * 2 - 1,
    y: -(((rect.top + rect.height / 2) / viewport.height) * 2 - 1),
    heightPx: rect.height,
    line: entry.line ?? null,
    emotion: entry.emotion ?? 'idle',
  };
}

/**
 * World scale that makes a cube of `cubeSize` world units appear `px` tall,
 * for a camera whose visible half-height at the cube's depth is `halfH`.
 */
export function pxToScale(px: number, viewportH: number, halfH: number, cubeSize: number): number {
  if (viewportH <= 0 || cubeSize <= 0) return 0;
  return ((px / viewportH) * 2 * halfH) / cubeSize;
}
