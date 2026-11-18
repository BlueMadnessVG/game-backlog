import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GazeReactions, type GazeContext } from '../gazeReactions';
import { pose } from '../pose';

const DT = 1 / 60;
const CUBE = { x: 500, y: 400, size: 200 };

const ctx = (overrides: Partial<GazeContext> = {}): GazeContext => ({
  cube: CUBE,
  tracking: true,
  reduced: false,
  lookJump: false,
  ...overrides,
});

/** Runs `frames` updates from `start` seconds; returns the time after the last one. */
function run(gaze: GazeReactions, start: number, frames: number, context = ctx()) {
  let t = start;
  for (let i = 0; i < frames; i++) {
    t += DT;
    gaze.update(t, DT, context);
  }
  return t;
}

beforeEach(() => {
  // Node has no window; the reactions only read the viewport size.
  vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
  Object.assign(pose.eyes, { wide: 0, squint: 0, blinkSeq: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GazeReactions: squint', () => {
  it('squints while the cursor is on the cube', () => {
    const gaze = new GazeReactions();
    gaze.onPointerMove(CUBE.x, CUBE.y, 0);
    run(gaze, 0, 60);
    expect(pose.eyes.squint).toBeGreaterThan(0.95);
  });

  it('relaxes once the cursor is far from the cube', () => {
    const gaze = new GazeReactions();
    gaze.onPointerMove(CUBE.x, CUBE.y, 0);
    const t = run(gaze, 0, 60);
    gaze.onPointerMove(CUBE.x + 400, CUBE.y + 300, t);
    run(gaze, t, 60);
    expect(pose.eyes.squint).toBeLessThan(0.05);
  });

  it('does not squint while not tracking the mouse', () => {
    const gaze = new GazeReactions();
    gaze.onPointerMove(CUBE.x, CUBE.y, 0);
    run(gaze, 0, 60, ctx({ tracking: false }));
    expect(pose.eyes.squint).toBeLessThan(0.01);
  });
});

describe('GazeReactions: wide eyes and flick blinks', () => {
  it('widens the eyes and blinks on a fast mouse flick', () => {
    const gaze = new GazeReactions();
    gaze.update(0, DT, ctx());
    gaze.onPointerMove(900, 700, DT);
    gaze.update(2 * DT, DT, ctx());
    expect(pose.eyes.wide).toBeGreaterThan(0);
    expect(pose.eyes.blinkSeq).toBe(1);
  });

  it('does neither with reduced motion', () => {
    const gaze = new GazeReactions();
    gaze.update(0, DT, ctx({ reduced: true }));
    gaze.onPointerMove(900, 700, DT);
    gaze.update(2 * DT, DT, ctx({ reduced: true }));
    expect(pose.eyes.wide).toBe(0);
    expect(pose.eyes.blinkSeq).toBe(0);
  });
});

describe('GazeReactions: blink on a side switch', () => {
  it('blinks once per jump, with a one-second cooldown', () => {
    const gaze = new GazeReactions();
    gaze.update(10, DT, ctx({ lookJump: true }));
    gaze.update(10.5, DT, ctx({ lookJump: true }));
    expect(pose.eyes.blinkSeq).toBe(1);

    gaze.update(11.1, DT, ctx({ lookJump: true }));
    expect(pose.eyes.blinkSeq).toBe(2);
  });
});

describe('GazeReactions: idle glances', () => {
  it('glances away after a few still seconds, within small bounds', () => {
    const gaze = new GazeReactions();
    gaze.onPointerMove(CUBE.x, CUBE.y, 0);
    expect(gaze.update(1, DT, ctx())).toBeNull();

    const glance = gaze.update(4.1, DT, ctx());
    expect(glance).not.toBeNull();
    expect(Math.abs(glance?.x ?? 99)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(glance?.y ?? 99)).toBeLessThanOrEqual(0.25);
  });

  it('stops glancing as soon as the mouse moves', () => {
    const gaze = new GazeReactions();
    gaze.onPointerMove(CUBE.x, CUBE.y, 0);
    gaze.update(1, DT, ctx());
    expect(gaze.update(4.1, DT, ctx())).not.toBeNull();

    gaze.onPointerMove(CUBE.x + 10, CUBE.y, 4.2);
    expect(gaze.update(4.25, DT, ctx())).toBeNull();
  });

  it('never glances while not tracking or with reduced motion', () => {
    const gaze = new GazeReactions();
    gaze.onPointerMove(CUBE.x, CUBE.y, 0);
    expect(gaze.update(5, DT, ctx({ tracking: false }))).toBeNull();
    expect(gaze.update(6, DT, ctx({ reduced: true }))).toBeNull();
  });
});
