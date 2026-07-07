import type { Game } from '@repo/shared';

export type GameCategory = 'playing' | 'completed' | 'backlog';

export const GAME_CATEGORY_CONFIG = {
  playing: {
    label: 'Playing',
    status: 'in-progress',
    color: '#3b82f6',
  },
  completed: {
    label: 'Completed',
    status: 'completed',
    color: '#10b981',
  },
  backlog: {
    label: 'Backlog',
    status: 'backlog',
    color: '#f59e0b',
  },
} as const;

export interface BillboardConfig {
  readonly position: Readonly<[number, number, number]>;
  readonly width: number;
  readonly height: number;
  readonly rotation: Readonly<[number, number, number]>;
  readonly category: GameCategory;
}

export interface BillboardUIState {
  readonly isOpen: boolean;
  readonly selectedGameIndex: number;
  readonly isNearby: boolean;
}

export interface CategorizedGames {
  readonly playing: readonly Game[];
  readonly completed: readonly Game[];
  readonly backlog: readonly Game[];
}

export const BILLBOARD_INTERACTION_DISTANCE = 15;
export const BILLBOARD_OVERLAY_FADE_DISTANCE = 20;
export const DEFAULT_BILLBOARD_WIDTH = 8;
export const DEFAULT_BILLBOARD_HEIGHT = 6;
