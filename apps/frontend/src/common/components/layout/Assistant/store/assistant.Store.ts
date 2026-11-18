import type { ReactNode } from 'react';

import { create } from 'zustand';

import type { AssistantDirector } from '../scene/director';

/**
 * State shared between the 3D assistant cube (inside the Canvas) and the DOM
 * that surrounds it (speech bubble, focusable cube button, title reveal).
 *
 * The cube writes `emotion`, `line` and `screen` from inside useFrame; DOM
 * components read them. `screen` is the cube's projected viewport position and
 * is consumed imperatively (store.subscribe) so it never re-renders React.
 *
 * What the current page contributes (each cleared when the page unmounts):
 *  - `scene`: extra 3D content for the shared canvas (useAssistantScene).
 *  - `accessory`: 3D parts attached to the cube body (useAssistantAccessory).
 *  - `director`: per-frame choreography (useAssistantDirector).
 *  - `anchorCount`: how many <AssistantAnchor> are mounted.
 * The cube is shown whenever any of these is present (see isAssistantActive).
 * `hint` is what the bubble says when the cube is clicked with no line.
 *
 * Exports:
 *  - Emotion, AssistantScreen.
 *  - useAssistantStore: zustand store.
 *  - isAssistantActive: whether the current page uses the cube.
 */
export type Emotion = 'idle' | 'happy' | 'think' | 'talk' | 'surprised' | 'sleep';

export interface AssistantScreen {
  /** Viewport pixels of the cube centre. */
  x: number;
  y: number;
  /** Rendered cube width in pixels. */
  size: number;
  visible: boolean;
}

interface AssistantState {
  /** The load counter finished; the cube may fly in and the title may split. */
  ready: boolean;
  emotion: Emotion;
  /** Short line the bubble shows, or null for none. */
  line: string | null;
  bubbleOpen: boolean;
  screen: AssistantScreen;
  /** Extra 3D content rendered inside the shared canvas, or null for none. */
  scene: ReactNode | null;
  /** 3D parts rendered inside the cube body, or null for none. */
  accessory: ReactNode | null;
  director: AssistantDirector | null;
  anchorCount: number;
  hint: string;
  setReady: () => void;
  setEmotion: (emotion: Emotion) => void;
  say: (line: string | null, emotion?: Emotion) => void;
  toggleBubble: () => void;
  setScreen: (screen: AssistantScreen) => void;
  setScene: (scene: ReactNode | null) => void;
  setAccessory: (accessory: ReactNode | null) => void;
  setDirector: (director: AssistantDirector | null) => void;
  /** +1 when an anchor mounts, -1 when it unmounts. */
  addAnchors: (delta: number) => void;
  setHint: (hint: string) => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  ready: false,
  emotion: 'sleep',
  line: null,
  bubbleOpen: true,
  screen: { x: 0, y: 0, size: 0, visible: false },
  scene: null,
  accessory: null,
  director: null,
  anchorCount: 0,
  hint: 'Soon you will be able to ask me about your library.',
  setReady: () => set({ ready: true }),
  setEmotion: (emotion) => set({ emotion }),
  say: (line, emotion) => set((s) => ({ line, emotion: emotion ?? s.emotion })),
  toggleBubble: () => set((s) => ({ bubbleOpen: !s.bubbleOpen })),
  setScreen: (screen) => set({ screen }),
  setScene: (scene) => set({ scene }),
  setAccessory: (accessory) => set({ accessory }),
  setDirector: (director) => set({ director }),
  addAnchors: (delta) => set((s) => ({ anchorCount: Math.max(0, s.anchorCount + delta) })),
  setHint: (hint) => set({ hint }),
}));

type ActiveFields = Pick<AssistantState, 'scene' | 'accessory' | 'director' | 'anchorCount'>;

/** The current page uses the cube (registered content, a director or anchors). */
export function isAssistantActive(s: ActiveFields): boolean {
  return s.scene !== null || s.accessory !== null || s.director !== null || s.anchorCount > 0;
}
