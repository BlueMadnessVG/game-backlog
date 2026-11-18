import * as THREE from 'three';

import { pose } from './assistantPose';

/**
 * Eye reactions to the mouse, computed once per frame by AssistantRig and
 * written to `pose.eyes` for the face:
 *  - wide:   eyes open up briefly on a fast mouse move.
 *  - squint: eyes narrow while the cursor sits on the cube.
 *  - blink:  one blink on a big gaze jump (a side switch or a flick).
 *  - glance: after a few still seconds, small random glances away and back.
 *
 * Exports:
 *  - GazeReactions: per-rig state; call onPointerMove from the pointer
 *    listener and update() every frame.
 */
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

/** NDC per second where the eyes start to widen, and where they are fully wide. */
const WIDE_SPEED = { from: 2, span: 4 };
/** NDC per second that counts as a flick (triggers a blink). */
const FLICK_SPEED = 8;
const BLINK_COOLDOWN = 1;
/** Cursor distance from the cube centre, in cube sizes: full squint → none. */
const SQUINT_RANGE = { near: 0.2, far: 1 };
/** Seconds without a mouse move before the idle glances start. */
const IDLE_AFTER = 4;
const GLANCE = { hold: 0.5, gapMin: 1.4, gapSpan: 1.2, x: 0.5, y: 0.25 };

export interface GazeContext {
  /** Cube centre and size in viewport pixels (from the last frame). */
  cube: { x: number; y: number; size: number };
  tracking: boolean;
  reduced: boolean;
  /** True on the frame the cube switched sides. */
  lookJump: boolean;
}

export class GazeReactions {
  private px = 0;
  private py = 0;
  private lastX = 0;
  private lastY = 0;
  private lastMove = -Infinity;
  private moved = false;
  private lastBlink = -Infinity;
  private glance: { x: number; y: number; until: number } | null = null;
  private nextGlance = 0;

  /** `x`/`y` in viewport pixels; `now` in seconds (performance clock). */
  onPointerMove(x: number, y: number, now: number) {
    this.px = x;
    this.py = y;
    this.lastMove = now;
    this.moved = true;
    this.glance = null;
  }

  /** Returns the current glance offset (NDC) to add to the aim, or null. */
  update(now: number, dt: number, ctx: GazeContext): { x: number; y: number } | null {
    const speed = this.pointerSpeed(dt);
    this.updateWide(speed, dt, ctx.reduced);
    this.updateSquint(dt, ctx);
    this.updateBlink(now, speed, ctx);
    return this.updateGlance(now, ctx);
  }

  /** Pointer speed in NDC per second since the last frame. */
  private pointerSpeed(dt: number) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const dx = ((this.px - this.lastX) / w) * 2;
    const dy = ((this.py - this.lastY) / h) * 2;
    this.lastX = this.px;
    this.lastY = this.py;
    if (!this.moved || dt <= 0) return 0;
    this.moved = false;
    return Math.hypot(dx, dy) / dt;
  }

  private updateWide(speed: number, dt: number, reduced: boolean) {
    const target = reduced ? 0 : clamp((speed - WIDE_SPEED.from) / WIDE_SPEED.span, 0, 1);
    const rate = target > pose.eyes.wide ? 14 : 3;
    pose.eyes.wide = damp(pose.eyes.wide, target, rate, dt);
  }

  private updateSquint(dt: number, { cube, tracking }: GazeContext) {
    let target = 0;
    if (tracking && cube.size > 0) {
      const dist = Math.hypot(this.px - cube.x, this.py - cube.y) / cube.size;
      target = clamp((SQUINT_RANGE.far - dist) / (SQUINT_RANGE.far - SQUINT_RANGE.near), 0, 1);
    }
    pose.eyes.squint = damp(pose.eyes.squint, target, 10, dt);
  }

  private updateBlink(now: number, speed: number, { reduced, lookJump }: GazeContext) {
    if (reduced || now - this.lastBlink < BLINK_COOLDOWN) return;
    if (lookJump || speed > FLICK_SPEED) {
      this.lastBlink = now;
      pose.eyes.blinkSeq += 1;
    }
  }

  private updateGlance(now: number, { tracking, reduced }: GazeContext) {
    if (reduced || !tracking || now - this.lastMove < IDLE_AFTER) {
      this.glance = null;
      this.nextGlance = now + GLANCE.gapMin;
      return null;
    }
    if (this.glance && now < this.glance.until) return this.glance;
    if (this.glance) {
      this.glance = null;
      this.nextGlance = now + GLANCE.gapMin + Math.random() * GLANCE.gapSpan;
    }
    if (now >= this.nextGlance) {
      this.glance = {
        x: (Math.random() * 2 - 1) * GLANCE.x,
        y: (Math.random() * 2 - 1) * GLANCE.y,
        until: now + GLANCE.hold,
      };
      return this.glance;
    }
    return null;
  }
}
