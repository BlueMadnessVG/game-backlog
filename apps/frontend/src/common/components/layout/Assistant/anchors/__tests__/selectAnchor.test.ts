import { describe, expect, it } from 'vitest';

import { pxToScale, selectAnchor } from '../selectAnchor';

import type { AnchorEntry } from '../registry';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const VIEWPORT = { width: 1000, height: 800 };

/** Builds anchors whose elements are only identities; `measure` returns their rects. */
function setup(specs: (Partial<AnchorEntry> & { id: string; rect: Rect })[]) {
  const rects = new Map<HTMLElement, Rect>();
  const anchors: AnchorEntry[] = specs.map(({ rect, ...spec }) => {
    const el = { id: spec.id } as unknown as HTMLElement;
    rects.set(el, rect);
    return { visible: true, ...spec, el };
  });
  const measure = (el: HTMLElement) => rects.get(el)!;
  return { anchors, measure };
}

const box = (cx: number, cy: number, size = 100): Rect => ({
  left: cx - size / 2,
  top: cy - size / 2,
  width: size,
  height: size,
});

describe('selectAnchor', () => {
  it('returns null when there are no anchors', () => {
    expect(selectAnchor([], VIEWPORT, () => box(0, 0))).toBeNull();
  });

  it('ignores anchors that are not visible or have no size', () => {
    const { anchors, measure } = setup([
      { id: 'hidden', visible: false, rect: box(500, 400) },
      { id: 'collapsed', rect: { left: 10, top: 10, width: 0, height: 0 } },
    ]);
    expect(selectAnchor(anchors, VIEWPORT, measure)).toBeNull();
  });

  it('picks the anchor nearest the vertical centre of the viewport', () => {
    const { anchors, measure } = setup([
      { id: 'top', rect: box(500, 100) },
      { id: 'middle', rect: box(500, 420) },
      { id: 'bottom', rect: box(500, 760) },
    ]);
    expect(selectAnchor(anchors, VIEWPORT, measure)?.id).toBe('middle');
  });

  it('lets a higher priority win over a nearer anchor', () => {
    const { anchors, measure } = setup([
      { id: 'near', rect: box(500, 400) },
      { id: 'header', priority: 1, rect: box(500, 60) },
    ]);
    expect(selectAnchor(anchors, VIEWPORT, measure)?.id).toBe('header');
  });

  it('maps the box centre to NDC (y up) and reports its height', () => {
    const { anchors, measure } = setup([{ id: 'a', rect: box(750, 200, 120) }]);
    const target = selectAnchor(anchors, VIEWPORT, measure);
    expect(target).toMatchObject({ id: 'a', heightPx: 120 });
    expect(target?.x).toBeCloseTo(0.5);
    expect(target?.y).toBeCloseTo(0.5);
  });

  it('defaults to no line and an idle face, and passes the anchor script through', () => {
    const { anchors, measure } = setup([{ id: 'plain', rect: box(500, 400) }]);
    expect(selectAnchor(anchors, VIEWPORT, measure)).toMatchObject({ line: null, emotion: 'idle' });

    const scripted = setup([{ id: 's', line: 'Hi', emotion: 'happy', rect: box(500, 400) }]);
    expect(selectAnchor(scripted.anchors, VIEWPORT, scripted.measure)).toMatchObject({
      line: 'Hi',
      emotion: 'happy',
    });
  });
});

describe('pxToScale', () => {
  const HALF_H = 1.5;
  const CUBE = 1.2;

  it('fills the viewport height when px equals the viewport height', () => {
    expect(pxToScale(800, 800, HALF_H, CUBE)).toBeCloseTo((2 * HALF_H) / CUBE);
  });

  it('is linear in px', () => {
    const quarter = pxToScale(200, 800, HALF_H, CUBE);
    expect(pxToScale(400, 800, HALF_H, CUBE)).toBeCloseTo(quarter * 2);
  });

  it('returns 0 for a zero-height viewport or cube', () => {
    expect(pxToScale(100, 0, HALF_H, CUBE)).toBe(0);
    expect(pxToScale(100, 800, HALF_H, 0)).toBe(0);
  });
});
