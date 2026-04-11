export type GameStatus = 'backlog' | 'in-progress' | 'completed' | 'retired';

export interface Game {
  id: string;
  title: string;
  platform: string;
  status: GameStatus;
  coverUrl: string;
  rating?: number;
  playTime: number;
}
