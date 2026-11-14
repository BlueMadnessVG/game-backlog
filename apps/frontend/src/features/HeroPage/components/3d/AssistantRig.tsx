import { useEffect, useRef, type ReactNode } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { pose } from './assistantPose';
import { useAssistantStore, type AssistantScreen, type Emotion } from '../../store/assistant.Store';
import {
  at,
  DISPLAY_TIMELINE,
  DOCK_COMPLETE,
  heroProgress,
  HOLOGRAM_GATE_END,
} from '../../timeline';
import { SECTION_SCRIPT, type SectionId } from '../../utils/assistantScript';
import { prefersReducedMotion } from '../../utils/motion';
import { SECTIONS } from '../../utils/sections';

/**
 * Poses the assistant for the whole page, once per frame:
 *
 *  1. Entry: after the load counter finishes, the cube spins in.
 *  2. Hero: it docks with a tilt, spreads its slabs and lights the platform
 *     corner that the timeline (`at(h)`) says is on stage.
 *  3. After the hero: it shrinks and glides to the nearest
 *     `[data-assistant-slot]` element in the DOM, and takes that section's
 *     emotion and line from the assistant script.
 *
 * It also writes the cube's projected viewport position to the store (for the
 * speech bubble and the focusable cube button) and keeps the canvas rendering
 * while it animates.
 *
 * Exports:
 *  - AssistantRig: wraps its children in the posed group (default export too).
 */
const CAMERA_Z = 5;
const HERO_SCALE_START = 1.45;
const HERO_SCALE_DOCK = 1.15;
const DOCKED_SCALE = 0.62;
const CUBE_SIZE = 1.2;
const DOCK_BLEND_START = 0.88;

const FALLBACK_NDC = { x: 0.72, y: -0.62 };
const PLATFORM_KEYS = DISPLAY_TIMELINE.map((d) => d.key);

const lerp = THREE.MathUtils.lerp;
const damp = (current: number, target: number, rate: number, delta: number) =>
  lerp(current, target, 1 - Math.exp(-rate * delta));
const clamp = THREE.MathUtils.clamp;

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** The slot nearest the viewport's vertical centre, as an NDC target. */
function nearestSlot(slots: HTMLElement[]) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let best: { dist: number; x: number; y: number; id: SectionId } | null = null;

  for (const el of slots) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) continue;
    const cy = rect.top + rect.height / 2;
    const dist = Math.abs(cy - vh / 2);
    if (best && dist >= best.dist) continue;
    best = {
      dist,
      x: ((rect.left + rect.width / 2) / vw) * 2 - 1,
      y: -((cy / vh) * 2 - 1),
      id: el.dataset.assistantSlot as SectionId,
    };
  }
  return best;
}

/** Idle sway (radians) and bob (world units); both zero for reduced motion. */
function idleMotion(t: number, still: boolean) {
  return still ? { sway: 0, bob: 0 } : { sway: Math.sin(t * 0.6) * 0.12, bob: Math.sin(t * 1.1) * 0.03 };
}

/** Whole-cube offset that expresses an emotion (the face has no mouth). */
interface Motion {
  dy: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
}

const REST: Motion = { dy: 0, rx: 0, ry: 0, rz: 0, scale: 1 };

/** Per-emotion body language. `t` is clock time, `since` is seconds since the change. */
const EMOTION_MOTION: Record<Emotion, (t: number, since: number) => Motion> = {
  idle: () => REST,
  happy: (t) => ({ ...REST, dy: Math.abs(Math.sin(t * 5)) * 0.06, rz: Math.sin(t * 10) * 0.05 }),
  think: (t) => ({ ...REST, rz: 0.14, ry: Math.sin(t * 0.8) * 0.18 }),
  talk: (t) => ({ ...REST, rx: Math.sin(t * 9) * 0.05, dy: Math.sin(t * 9) * 0.015 }),
  surprised: (_t, since) => {
    const k = Math.exp(-6 * since);
    return { ...REST, scale: 1 + 0.1 * k, dy: 0.08 * k, rx: -0.15 * k };
  },
  sleep: (t) => ({
    ...REST,
    rx: 0.18,
    dy: Math.sin(t * 0.5) * 0.02,
    scale: 1 + Math.sin(t * 1.2) * 0.02,
  }),
};

/** Damps `current` toward the emotion's target motion, in place. */
function blendMotion(current: Motion, target: Motion, dt: number) {
  current.dy = damp(current.dy, target.dy, 8, dt);
  current.rx = damp(current.rx, target.rx, 8, dt);
  current.ry = damp(current.ry, target.ry, 8, dt);
  current.rz = damp(current.rz, target.rz, 8, dt);
  current.scale = damp(current.scale, target.scale, 8, dt);
}

/** Sideways step (NDC) that keeps the cube clear of the part-callout text. */
const CALLOUT_SHIFT = 0.4;
/** Below this width the callout is a bottom sheet, so the cube stays centred. */
const NARROW_WIDTH = 720;

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
  docking: boolean;
  section: SectionId | null;
  progress: number;
  platformOnStage: boolean;
  beating: boolean;
}

function chooseEmotion(i: EmotionInput): Emotion {
  if (!i.ready) return 'sleep';
  if (!i.entered) return 'surprised';
  if (i.docking && i.section) return SECTION_SCRIPT[i.section].emotion;
  if (i.progress >= HOLOGRAM_GATE_END) return 'happy';
  if (i.platformOnStage) return 'talk';
  return i.beating ? 'think' : 'idle';
}

function screenChanged(a: AssistantScreen, b: AssistantScreen) {
  return (
    Math.abs(a.x - b.x) > 0.5 ||
    Math.abs(a.y - b.y) > 0.5 ||
    Math.abs(a.size - b.size) > 0.5 ||
    a.visible !== b.visible
  );
}

export function AssistantRig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const entry = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const docked = useRef({ ...FALLBACK_NDC });
  const slots = useRef<HTMLElement[]>([]);
  const frameCount = useRef(0);
  const lastEmotion = useRef<Emotion | null>(null);
  const lastSection = useRef<SectionId | null>(null);
  const lastScreen = useRef<AssistantScreen>({ x: -1, y: -1, size: -1, visible: false });
  const reduced = useRef(false);
  const motion = useRef<Motion>({ ...REST });
  const emotionSince = useRef(0);
  const shift = useRef(0);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  /** Eases the docked target toward the nearest slot and returns that slot's id. */
  const updateDock = (dt: number): SectionId | null => {
    frameCount.current += 1;
    if (frameCount.current % 30 === 1) {
      slots.current = Array.from(document.querySelectorAll<HTMLElement>('[data-assistant-slot]'));
    }
    const slot = nearestSlot(slots.current);
    const target = slot ?? FALLBACK_NDC;
    docked.current.x = damp(docked.current.x, clamp(target.x, -0.85, 0.85), 6, dt);
    docked.current.y = damp(docked.current.y, clamp(target.y, -0.7, 0.7), 6, dt);
    return slot ? slot.id : null;
  };

  /** Updates the emotion body motion for this frame (zero for reduced motion). */
  const updateMotion = (t: number, dt: number): Motion => {
    const emotion = lastEmotion.current ?? 'idle';
    const target = reduced.current ? REST : EMOTION_MOTION[emotion](t, t - emotionSince.current);
    blendMotion(motion.current, target, dt);
    return motion.current;
  };

  const syncStore = (
    emotion: Emotion,
    section: SectionId | null,
    screen: AssistantScreen,
    t: number,
  ) => {
    const store = useAssistantStore.getState();
    if (emotion !== lastEmotion.current) {
      lastEmotion.current = emotion;
      emotionSince.current = t;
      store.setEmotion(emotion);
    }
    if (section !== lastSection.current) {
      lastSection.current = section;
      store.say(section ? SECTION_SCRIPT[section].line : null);
    }
    if (screenChanged(screen, lastScreen.current)) {
      lastScreen.current = screen;
      store.setScreen(screen);
    }
  };

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;

    const ready = useAssistantStore.getState().ready;
    const dt = Math.min(delta, 0.05);
    const still = reduced.current;

    // Entry
    entry.current = nextEntry(entry.current, ready, still, dt);
    const entered = entry.current >= 1;
    const entryEase = 1 - Math.pow(1 - entry.current, 3);
    g.visible = ready;

    // Timeline state
    const r = heroProgress.get();
    const { platform, display } = at(r);
    const dock = Math.min(r / DOCK_COMPLETE, 1);
    const beating = display > 0 && r < HOLOGRAM_GATE_END;
    for (const key of PLATFORM_KEYS) pose.active[key].current = platform === key ? 1 : 0;
    pose.spread = damp(pose.spread, beating ? (platform ? 0.7 : 0.25) : 0, 6, dt);

    // Pointer look
    pose.look.x = damp(pose.look.x, still ? 0 : pointer.current.x, 5, dt);
    pose.look.y = damp(pose.look.y, still ? 0 : pointer.current.y, 5, dt);

    // Docking below the hero
    const dockBlend = smoothstep(DOCK_BLEND_START, 1, r);
    const section = dockBlend > 0 ? updateDock(dt) : null;

    // Pose
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z;
    const halfW = halfH * (size.width / size.height);
    const t = clock.elapsedTime;
    const { sway, bob } = idleMotion(t, still);
    const m = updateMotion(t, dt);

    const heroScale = lerp(HERO_SCALE_START, HERO_SCALE_DOCK, dock);
    const scale =
      lerp(heroScale, DOCKED_SCALE, dockBlend) * (0.001 + 0.999 * entryEase) * m.scale;
    const lift = (bob + m.dy) * (scale / HERO_SCALE_DOCK);
    const heroY = lerp(0, -0.1, dock) + lerp(-6, 0, entryEase) + lift;

    const shiftTarget = calloutShift(display, r, size.width < NARROW_WIDTH);
    shift.current = still ? shiftTarget : damp(shift.current, shiftTarget, 4, dt);

    g.position.set(
      lerp(shift.current * halfW, docked.current.x * halfW, dockBlend),
      lerp(heroY, docked.current.y * halfH + lift, dockBlend),
      0,
    );
    g.scale.setScalar(scale);
    g.rotation.set(
      lerp(-Math.PI * 1.3, 0, entryEase) + lerp(0, -0.22, dock) - pose.look.y * 0.25 + m.rx,
      lerp(Math.PI * 2, 0, entryEase) + sway + pose.look.x * 0.4 + m.ry,
      lerp(Math.PI * 0.3, 0, entryEase) + m.rz,
    );

    // Store: emotion, line, projected position
    const docking = dockBlend > 0.5;
    const emotion = chooseEmotion({
      ready,
      entered,
      docking,
      section,
      progress: r,
      platformOnStage: platform !== null,
      beating,
    });
    const screenSize = ((CUBE_SIZE * scale) / (2 * halfH)) * size.height;
    syncStore(
      emotion,
      docking ? section : null,
      {
        x: (g.position.x / halfW) * 0.5 * size.width + size.width / 2,
        y: size.height / 2 - (g.position.y / halfH) * 0.5 * size.height,
        size: screenSize,
        visible: ready && entered,
      },
      t,
    );

    // The cube is alive: keep the demand-driven canvas rendering.
    invalidate();
  });

  return <group ref={group}>{children}</group>;
}

export default AssistantRig;
