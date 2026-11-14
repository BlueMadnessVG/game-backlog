import { useEffect, useState } from 'react';

import * as THREE from 'three';

import type { Emotion } from '../../store/assistant.Store';

/**
 * The assistant's face: a small 2D canvas drawn per emotion and uploaded as a
 * texture. There is no mouth — each state reads from the eyes alone (and from
 * the body motion in AssistantRig). It is only redrawn when what would be
 * drawn changes (emotion, blink, quantised look/scan, talk animation frame),
 * so an idle face costs nothing per frame.
 *
 * Two shapes share the same drawing code through a layout:
 *  - 'wide': 512×224, for a rectangular screen (procedural body).
 *  - 'round': 384×384, for a circular screen; the circle mesh clips it.
 *
 * Exports:
 *  - FACE_W / FACE_H: wide canvas size in pixels (the wide plane uses its aspect).
 *  - FACE_ROUND: round canvas size in pixels.
 *  - FaceShape, FaceRenderer, useFaceTexture.
 */
export const FACE_W = 512;
export const FACE_H = 224;
export const FACE_ROUND = 384;

export type FaceShape = 'wide' | 'round';

const INK = '#d0bcff';
const SCREEN = '#0a0814';
/** Redraw rate of the talking sound wave. */
const TALK_FPS = 24;
/** Redraw rate of the thinking dots. */
const THINK_FPS = 20;
/** Number of equalizer bars behind the eyes while talking. */
const BAR_COUNT = 23;
/** Travelling wave that drives the bar heights: frequencies, scroll speed, peak px. */
const WAVE = { f1: 2.2, f2: 5.1, speed: 6, peak: 46 };

interface Layout {
  w: number;
  h: number;
  left: number;
  right: number;
  eyeY: number;
  /** Size scale for eyes, strokes and look offsets. */
  s: number;
}

const LAYOUTS: Record<FaceShape, Layout> = {
  wide: { w: FACE_W, h: FACE_H, left: 160, right: 352, eyeY: 112, s: 1.15 },
  round: { w: FACE_ROUND, h: FACE_ROUND, left: 120, right: 264, eyeY: 192, s: 1.25 },
};

type Ctx = CanvasRenderingContext2D;

function pill(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2);
  ctx.fill();
}

function arc(ctx: Ctx, x: number, y: number, r: number, from: number, to: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, from, to);
  ctx.stroke();
}

interface Pose {
  /** Eye centres and the shared eye line, already shifted by look/scan. */
  left: number;
  right: number;
  y: number;
  /** Look vector, -1..1. */
  lx: number;
  ly: number;
  blink: boolean;
  frame: number;
  s: number;
}

type Draw = (ctx: Ctx, p: Pose) => void;

const DRAW: Record<Emotion, Draw> = {
  idle: (ctx, p) => {
    const h = p.blink ? 6 : 76 * p.s;
    pill(ctx, p.left, p.y, 54 * p.s, h);
    pill(ctx, p.right, p.y, 54 * p.s, h);
  },
  // Same eyes as idle; the sound wave behind them (drawVoiceWave) carries the speech.
  talk: (ctx, p) => {
    const h = p.blink ? 6 : 76 * p.s;
    pill(ctx, p.left, p.y, 54 * p.s, h);
    pill(ctx, p.right, p.y, 54 * p.s, h);
  },
  // No eyes: three dots with a bounce-and-brighten wave running left to right.
  think: (ctx, p) => {
    const t = p.frame / THINK_FPS;
    const cx = (p.left + p.right) / 2;
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.sin((t * 2.4 - i * 0.55) * Math.PI));
      ctx.globalAlpha = 0.3 + 0.7 * k;
      ctx.beginPath();
      ctx.arc(cx + (i - 1) * 48 * p.s, p.y - k * 14 * p.s, 16 * p.s * (1 + 0.15 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  happy: (ctx, p) => {
    ctx.lineWidth = 18 * p.s;
    arc(ctx, p.left, p.y + 16 * p.s, 34 * p.s, Math.PI * 1.1, Math.PI * 1.9);
    arc(ctx, p.right, p.y + 16 * p.s, 34 * p.s, Math.PI * 1.1, Math.PI * 1.9);
  },
  surprised: (ctx, p) => {
    for (const x of [p.left, p.right]) {
      arc(ctx, x, p.y, 40 * p.s, 0, Math.PI * 2);
      ctx.beginPath();
      ctx.arc(x + p.lx * 10 * p.s, p.y + p.ly * 6 * p.s, 12 * p.s, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  sleep: (ctx, p) => {
    for (const x of [p.left, p.right]) {
      arc(ctx, x, p.y - 4 * p.s, 30 * p.s, Math.PI * 0.2, Math.PI * 0.8);
    }
  },
};

/**
 * Faint equalizer behind the eyes while talking: a row of separate vertical
 * bars whose heights follow a travelling wave (so the peaks move across the
 * face) under a syllable-like envelope, shortest at the screen edges so they
 * stay inside a round screen. Taller bars are slightly brighter.
 */
function drawVoiceWave(ctx: Ctx, layout: Layout, t: number) {
  const { w, eyeY, s } = layout;
  const envelope = 0.35 + 0.65 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1));
  const slot = w / BAR_COUNT;
  const minH = 6 * s;
  const maxH = 2 * WAVE.peak * s;

  ctx.fillStyle = INK;
  ctx.shadowColor = INK;
  ctx.shadowBlur = 8 * s;

  for (let i = 0; i < BAR_COUNT; i++) {
    const u = (i + 0.5) / BAR_COUNT;
    const wave = Math.abs(
      0.6 * Math.sin(u * Math.PI * 2 * WAVE.f1 + t * WAVE.speed) +
        0.4 * Math.sin(u * Math.PI * 2 * WAVE.f2 - t * WAVE.speed * 0.7),
    );
    const level = wave * envelope * Math.sin(Math.PI * u);
    ctx.globalAlpha = 0.18 + 0.22 * level;
    pill(ctx, slot * (i + 0.5), eyeY, 7 * s, Math.max(minH, level * maxH));
  }
  ctx.globalAlpha = 1;
}

function drawFace(ctx: Ctx, layout: Layout, emotion: Emotion, p: Pose) {
  ctx.clearRect(0, 0, layout.w, layout.h);
  ctx.fillStyle = SCREEN;
  ctx.fillRect(0, 0, layout.w, layout.h);

  if (emotion === 'talk') drawVoiceWave(ctx, layout, p.frame / TALK_FPS);

  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 14 * layout.s;
  ctx.shadowColor = INK;
  ctx.shadowBlur = 24 * layout.s;

  DRAW[emotion](ctx, p);
}

export class FaceRenderer {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: Ctx | null;
  private readonly layout: Layout;
  private signature = '';
  private nextBlink = 2.5;
  private blinkUntil = 0;

  constructor(shape: FaceShape = 'wide') {
    this.layout = LAYOUTS[shape];
    const canvas = document.createElement('canvas');
    canvas.width = this.layout.w;
    canvas.height = this.layout.h;
    this.ctx = canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  /** Call once per frame. `time` is seconds; `look` is -1..1 per axis. */
  update(time: number, emotion: Emotion, look: { x: number; y: number }, allowBlink = true) {
    if (!this.ctx) return;

    if (allowBlink && time >= this.nextBlink) {
      this.blinkUntil = time + 0.14;
      this.nextBlink = time + 3 + Math.random() * 3;
    }
    const thinking = emotion === 'think';
    // Thinking shows dots, not eyes: no blink, no cursor follow.
    const blink = !thinking && time < this.blinkUntil;
    const fps = emotion === 'talk' ? TALK_FPS : thinking ? THINK_FPS : 0;
    const frame = Math.floor(time * fps);
    const lx = thinking ? 0 : Math.round(look.x * 4) / 4;
    const ly = thinking ? 0 : Math.round(look.y * 4) / 4;

    const signature = `${emotion}|${blink ? 1 : 0}|${lx}|${ly}|${frame}`;
    if (signature === this.signature) return;
    this.signature = signature;

    const { left, right, eyeY, s } = this.layout;
    drawFace(this.ctx, this.layout, emotion, {
      left: left + lx * 18 * s,
      right: right + lx * 18 * s,
      y: eyeY - ly * 10 * s,
      lx,
      ly,
      blink,
      frame,
      s,
    });
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

export function useFaceTexture(shape: FaceShape = 'wide'): FaceRenderer {
  const [face] = useState(() => new FaceRenderer(shape));
  useEffect(() => () => face.dispose(), [face]);
  return face;
}
