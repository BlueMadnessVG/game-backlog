import { describe, expect, it } from 'vitest';

import { lookTarget, sideOf } from '../gaze';

describe('sideOf', () => {
  it.each([
    [-0.8, -1],
    [-0.16, -1],
    [-0.1, 0],
    [0, 0],
    [0.15, 0],
    [0.2, 1],
    [0.9, 1],
  ] as const)('x = %s → %s', (x, side) => {
    expect(sideOf(x)).toBe(side);
  });
});

describe('lookTarget', () => {
  it('points from the cube toward the aim', () => {
    expect(lookTarget({ x: 0.3, y: -0.2 }, { x: 0.5, y: 0.1 })).toEqual({
      x: expect.closeTo(-0.2) as number,
      y: expect.closeTo(-0.3) as number,
    });
  });

  it('looks at the screen centre when there is no aim', () => {
    expect(lookTarget(null, { x: 0.6, y: -0.4 })).toEqual({
      x: expect.closeTo(-0.6) as number,
      y: expect.closeTo(0.4) as number,
    });
  });

  it('is zero when the aim is the cube itself', () => {
    expect(lookTarget({ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 })).toEqual({ x: 0, y: 0 });
  });

  it('clamps each axis to -1..1', () => {
    expect(lookTarget({ x: 1, y: -1 }, { x: -0.8, y: 0.9 })).toEqual({ x: 1, y: -1 });
  });
});
