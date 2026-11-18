import * as THREE from 'three';

import { platformActive } from '../components/3d/platformActivation';
import { at, DISPLAY_TIMELINE, DOCK_COMPLETE, heroProgress, HOLOGRAM_GATE_END } from '../timeline';
import { SECTIONS } from '../utils/sections';

import {
  pose,
  useAssistantStore,
  type AssistantDirector,
  type Emotion,
} from '@/common/components/layout/Assistant';

/**
 * The hero's choreography for the app-wide assistant cube (registered with
 * useAssistantDirector while the hero is mounted):
 *
 *  1. Entry: after the load counter finishes, the cube spins and grows in.
 *  2. Hero: it docks with a tilt, spreads (`pose.spread`), lights the platform
 *     corner that the timeline (`at(h)`) says is on stage, and steps sideways
 *     away from the part-callout text.
 *  3. After the hero: `dockBlend` hands the cube to the page's anchors.
 *
 * Exports:
 *  - createHeroDirector: a fresh director (it keeps its own entry/shift state).
 */
const HERO_SCALE_START = 1.45;
const HERO_SCALE_DOCK = 1.15;
const DOCK_BLEND_START = 0.88;
/** Sideways step (NDC) that keeps the cube clear of the part-callout text. */
const CALLOUT_SHIFT = 0.4;
/** Below this width the callout is a bottom sheet, so the cube stays centred. */
const NARROW_WIDTH = 720;

const PLATFORM_KEYS = DISPLAY_TIMELINE.map((d) => d.key);
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const damp = (current: number, target: number, rate: number, delta: number) =>
  lerp(current, target, 1 - Math.exp(-rate * delta));

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Horizontal target (NDC) while a part callout is on screen: the side opposite
 * the chapter's text. `display` holds the last platform through the gaps, so
 * the cube does not bounce back to centre between beats.
 */
function calloutShift(display: number, progress: number, narrow: boolean): number {
  if (narrow || display === 0 || progress >= HOLOGRAM_GATE_END) return 0;
  const chapter = SECTIONS.find((c) => c.index === display);
  if (!chapter) return 0;
  return chapter.alignment === 'left' ? CALLOUT_SHIFT : -CALLOUT_SHIFT;
}

function nextEntry(current: number, ready: boolean, still: boolean, dt: number) {
  if (!ready || current >= 1) return current;
  return still ? 1 : Math.min(current + dt * 0.6, 1);
}

interface EmotionInput {
  ready: boolean;
  entered: boolean;
  progress: number;
  platformOnStage: boolean;
  beating: boolean;
}

/** The hero's face before docking (anchors take over once docked). */
function heroEmotion(i: EmotionInput): Emotion {
  if (!i.ready) return 'sleep';
  if (!i.entered) return 'surprised';
  if (i.progress >= HOLOGRAM_GATE_END) return 'happy';
  if (i.platformOnStage) return 'talk';
  return i.beating ? 'think' : 'idle';
}

export function createHeroDirector(): AssistantDirector {
  let entry = 0;
  let shift = 0;

  return ({ dt, still, halfW, width }) => {
    const ready = useAssistantStore.getState().ready;

    // Entry
    entry = nextEntry(entry, ready, still, dt);
    const entered = entry >= 1;
    const entryEase = 1 - Math.pow(1 - entry, 3);

    // Timeline state
    const r = heroProgress.get();
    const { platform, display } = at(r);
    const dock = Math.min(r / DOCK_COMPLETE, 1);
    const beating = display > 0 && r < HOLOGRAM_GATE_END;
    for (const key of PLATFORM_KEYS) platformActive[key].current = platform === key ? 1 : 0;
    pose.spread = damp(pose.spread, beating ? (platform ? 0.7 : 0.25) : 0, 6, dt);

    // Sideways step away from the callout text
    const shiftTarget = calloutShift(display, r, width < NARROW_WIDTH);
    shift = still ? shiftTarget : damp(shift, shiftTarget, 4, dt);

    return {
      dockBlend: smoothstep(DOCK_BLEND_START, 1, r),
      x: shift * halfW,
      y: lerp(0, -0.1, dock) + lerp(-6, 0, entryEase),
      scale: lerp(HERO_SCALE_START, HERO_SCALE_DOCK, dock),
      scaleMul: 0.001 + 0.999 * entryEase,
      rx: lerp(-Math.PI * 1.3, 0, entryEase) + lerp(0, -0.22, dock),
      ry: lerp(Math.PI * 2, 0, entryEase),
      rz: lerp(Math.PI * 0.3, 0, entryEase),
      headingX: shiftTarget,
      emotion: heroEmotion({
        ready,
        entered,
        progress: r,
        platformOnStage: platform !== null,
        beating,
      }),
      emotionLocked: !ready || !entered,
      visible: ready,
      interactive: ready && entered,
    };
  };
}
