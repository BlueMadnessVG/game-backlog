import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { CUBE_SIZE } from './AssistantCube';
import { anchorRegistry } from '../anchors/registry';
import { pxToScale, selectAnchor, type AnchorTarget } from '../anchors/selectAnchor';
import { GazeReactions } from '../face/gazeReactions';
import { pose } from '../face/pose';
import {
  isAssistantActive,
  useAssistantStore,
  type AssistantScreen,
  type Emotion,
} from '../store/assistant.Store';
import { prefersReducedMotion } from '../utils/motion';

import type { DirectorPose } from './director';

/**
 * Poses the app-wide assistant cube, once per frame:
 *
 *  1. Docking: it glides to the chosen <AssistantAnchor> (see selectAnchor),
 *     takes that box's height as its on-screen size, and that anchor's
 *     emotion and line. With no anchor it parks in a corner.
 *  2. Director: if the page registered one (useAssistantDirector), its pose is
 *     blended with the docked pose by `dockBlend` — e.g. the hero's entry spin
 *     and scroll timeline.
 *  3. On top of either: idle sway and bob, per-emotion body language, and a
 *     gaze that follows the pointer from the cube's own position (looking at
 *     the centre after a left/right switch until the mouse moves again), plus
 *     the eye reactions (GazeReactions).
 *
 * It writes the cube's projected viewport position to the store (for the
 * speech bubble and the focusable cube button) and keeps the demand-driven
 * canvas rendering while the current page uses the cube.
 *
 * Exports:
 *  - AssistantRig: wraps its children in the posed group (default export too).
 */
const CAMERA_Z = 5;
/** Scale the idle bob and emotion offsets were tuned at. */
const MOTION_REF_SCALE = 1.15;
/** Where and how big the cube sits when no anchor is near (NDC, scale). */
const FALLBACK_NDC = { x: 0.72, y: -0.62 };
const FALLBACK_SCALE = 0.62;
/** Gaze gain on the cube→pointer vector (NDC), before clamping to -1..1. */
const LOOK_GAIN = 1;
/** |NDC x| below this counts as the centre when detecting a left/right switch. */
const SIDE_DEADZONE = 0.15;

const lerp = THREE.MathUtils.lerp;
const damp = (current: number, target: number, rate: number, delta: number) =>
  lerp(current, target, 1 - Math.exp(-rate * delta));
const clamp = THREE.MathUtils.clamp;

/** Eases the docked scale toward `target` (jumps for reduced motion). */
function nextDockScale(current: number, target: number, still: boolean, dt: number) {
  return still ? target : damp(current, target, 4, dt);
}

/** Screen side for an NDC x: -1 left, 0 centre (inside the dead-zone), 1 right. */
function sideOf(x: number): -1 | 0 | 1 {
  if (x > SIDE_DEADZONE) return 1;
  if (x < -SIDE_DEADZONE) return -1;
  return 0;
}

/**
 * Target gaze (-1..1 per axis), measured from the cube's own screen position:
 * toward `aim` (the pointer) or, with no aim, toward the screen centre.
 */
function lookTarget(aim: { x: number; y: number } | null, cube: { x: number; y: number }) {
  const ax = aim ? aim.x : 0;
  const ay = aim ? aim.y : 0;
  return {
    x: clamp((ax - cube.x) * LOOK_GAIN, -1, 1),
    y: clamp((ay - cube.y) * LOOK_GAIN, -1, 1),
  };
}

/** Idle sway (radians) and bob (world units); both zero for reduced motion. */
function idleMotion(t: number, still: boolean) {
  return still
    ? { sway: 0, bob: 0 }
    : { sway: Math.sin(t * 0.6) * 0.12, bob: Math.sin(t * 1.1) * 0.03 };
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

type FullPose = Required<DirectorPose>;

/** Pose used when the page has no director: fully docked, nothing extra. */
const NO_DIRECTOR: FullPose = {
  dockBlend: 1,
  x: 0,
  y: 0,
  scale: FALLBACK_SCALE,
  scaleMul: 1,
  rx: 0,
  ry: 0,
  rz: 0,
  headingX: 0,
  emotion: 'idle',
  emotionLocked: false,
  visible: true,
  interactive: true,
};

/** The director's pose with every optional field filled in. */
function fullPose(d: DirectorPose | null): FullPose {
  return d ? { ...NO_DIRECTOR, ...d } : NO_DIRECTOR;
}

/** Director emotion when locked; else the docked anchor's; else the director's. */
function chooseEmotion(d: FullPose, docking: boolean, anchor: AnchorTarget | null) {
  if (d.emotionLocked) return d.emotion;
  if (docking && anchor) return anchor.emotion;
  return d.emotion;
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

  const pointer = useRef({ x: 0, y: 0 });
  const docked = useRef({ ...FALLBACK_NDC });
  const lastEmotion = useRef<Emotion | null>(null);
  const lastLine = useRef<string | null>(null);
  const lastScreen = useRef<AssistantScreen>({ x: -1, y: -1, size: -1, visible: false });
  const reduced = useRef(false);
  const motion = useRef<Motion>({ ...REST });
  const emotionSince = useRef(0);
  const dockScale = useRef(FALLBACK_SCALE);
  /** True once the mouse moves; reset when the cube switches sides. */
  const tracking = useRef(false);
  const side = useRef<-1 | 0 | 1>(0);
  const [gaze] = useState(() => new GazeReactions());

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
      tracking.current = true;
      gaze.onPointerMove(e.clientX, e.clientY, performance.now() / 1000);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [gaze]);

  /** Eases the docked target toward the chosen anchor and returns it (null: none). */
  const updateDock = (dt: number): AnchorTarget | null => {
    const anchor = selectAnchor(anchorRegistry.values(), size);
    const target = anchor ?? FALLBACK_NDC;
    docked.current.x = damp(docked.current.x, clamp(target.x, -0.85, 0.85), 6, dt);
    docked.current.y = damp(docked.current.y, clamp(target.y, -0.7, 0.7), 6, dt);
    return anchor;
  };

  /**
   * Eases `pose.look` toward the pointer as seen from the cube. When the cube
   * heads to the other side of the screen it looks at the centre instead,
   * until the mouse moves again. Also runs the eye reactions (GazeReactions);
   * an idle glance offsets the aim for a moment.
   */
  const updateLook = (
    g: THREE.Group,
    headingX: number,
    halfW: number,
    halfH: number,
    dt: number,
  ) => {
    const next = sideOf(headingX);
    let lookJump = false;
    if (next !== 0) {
      lookJump = side.current !== 0 && next !== side.current;
      if (lookJump) tracking.current = false;
      side.current = next;
    }
    const { x, y, size: cubeSize } = lastScreen.current;
    const glance = gaze.update(performance.now() / 1000, dt, {
      cube: { x, y, size: cubeSize },
      tracking: tracking.current,
      reduced: reduced.current,
      lookJump,
    });
    const aim = tracking.current
      ? { x: pointer.current.x + (glance?.x ?? 0), y: pointer.current.y + (glance?.y ?? 0) }
      : null;
    const target = reduced.current
      ? { x: 0, y: 0 }
      : lookTarget(aim, { x: g.position.x / halfW, y: g.position.y / halfH });
    pose.look.x = damp(pose.look.x, target.x, 5, dt);
    pose.look.y = damp(pose.look.y, target.y, 5, dt);
  };

  /** Updates the emotion body motion for this frame (zero for reduced motion). */
  const updateMotion = (t: number, dt: number): Motion => {
    const emotion = lastEmotion.current ?? 'idle';
    const target = reduced.current ? REST : EMOTION_MOTION[emotion](t, t - emotionSince.current);
    blendMotion(motion.current, target, dt);
    return motion.current;
  };

  const syncStore = (emotion: Emotion, line: string | null, screen: AssistantScreen, t: number) => {
    const store = useAssistantStore.getState();
    if (emotion !== lastEmotion.current) {
      lastEmotion.current = emotion;
      emotionSince.current = t;
      store.setEmotion(emotion);
    }
    if (line !== lastLine.current) {
      lastLine.current = line;
      store.say(line);
    }
    if (screenChanged(screen, lastScreen.current)) {
      lastScreen.current = screen;
      store.setScreen(screen);
    }
  };

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;

    const store = useAssistantStore.getState();
    const active = isAssistantActive(store);
    const dt = Math.min(delta, 0.05);
    const still = reduced.current;
    const t = clock.elapsedTime;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z;
    const halfW = halfH * (size.width / size.height);

    // Page choreography (optional), then docking
    const d = fullPose(
      store.director?.({ t, dt, still, halfW, halfH, width: size.width, height: size.height }) ??
        null,
    );
    const dockBlend = d.dockBlend;
    const anchor = dockBlend > 0 ? updateDock(dt) : null;
    const dockTarget = anchor
      ? pxToScale(anchor.heightPx, size.height, halfH, CUBE_SIZE)
      : FALLBACK_SCALE;
    dockScale.current = nextDockScale(dockScale.current, dockTarget, still, dt);

    // Pose
    const { sway, bob } = idleMotion(t, still);
    const m = updateMotion(t, dt);
    const scale = lerp(d.scale, dockScale.current, dockBlend) * d.scaleMul * m.scale;
    const lift = (bob + m.dy) * (scale / MOTION_REF_SCALE);

    // Gaze, from where the cube is now (before it moves this frame)
    updateLook(g, lerp(d.headingX, docked.current.x, dockBlend), halfW, halfH, dt);

    g.visible = active && d.visible;
    g.position.set(
      lerp(d.x, docked.current.x * halfW, dockBlend),
      lerp(d.y, docked.current.y * halfH, dockBlend) + lift,
      0,
    );
    g.scale.setScalar(scale);
    g.rotation.set(
      d.rx - pose.look.y * 0.25 + m.rx,
      d.ry + sway + pose.look.x * 0.4 + m.ry,
      d.rz + m.rz,
    );

    // Store: emotion, line, projected position
    const docking = dockBlend > 0.5;
    const screenSize = ((CUBE_SIZE * scale) / (2 * halfH)) * size.height;
    syncStore(
      chooseEmotion(d, docking, anchor),
      docking && anchor ? anchor.line : null,
      {
        x: (g.position.x / halfW) * 0.5 * size.width + size.width / 2,
        y: size.height / 2 - (g.position.y / halfH) * 0.5 * size.height,
        size: screenSize,
        visible: active && d.interactive,
      },
      t,
    );

    // The cube is alive while a page uses it: keep the demand-driven canvas rendering.
    if (active) invalidate();
  });

  return <group ref={group}>{children}</group>;
}

export default AssistantRig;
