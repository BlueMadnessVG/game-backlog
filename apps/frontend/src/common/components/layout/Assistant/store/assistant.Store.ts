import { create } from 'zustand';

/**
 * State shared between the 3D assistant cube (inside the Canvas) and the DOM
 * that surrounds it (speech bubble, focusable cube button, title reveal).
 *
 * The cube writes `emotion`, `line` and `screen` from inside useFrame; DOM
 * components read them. `screen` is the cube's projected viewport position and
 * is consumed imperatively (store.subscribe) so it never re-renders React.
 *
 * Exports:
 *  - Emotion: the faces the cube can show.
 *  - useAssistantStore: zustand store.
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
  setReady: () => void;
  setEmotion: (emotion: Emotion) => void;
  say: (line: string | null, emotion?: Emotion) => void;
  toggleBubble: () => void;
  setScreen: (screen: AssistantScreen) => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  ready: false,
  emotion: 'sleep',
  line: null,
  bubbleOpen: true,
  screen: { x: 0, y: 0, size: 0, visible: false },
  setReady: () => set({ ready: true }),
  setEmotion: (emotion) => set({ emotion }),
  say: (line, emotion) => set((s) => ({ line, emotion: emotion ?? s.emotion })),
  toggleBubble: () => set((s) => ({ bubbleOpen: !s.bubbleOpen })),
  setScreen: (screen) => set({ screen }),
}));
