import type { Achievement, Game, Stats } from '@repo/shared';

/**
 * Synthetic sample payloads used by the deep-dive chapter panels. Every value
 * here is fabricated — fake titles, ids and numbers — but each object is
 * shaped exactly like the Valibot schema it documents so the panels show real
 * payload structure without leaking any user data. Nothing in this file is
 * fetched at runtime; it is static display data.
 */

export const SYNTHETIC_NOTICE = 'SYNTHETIC SAMPLE — NOT REAL DATA';

/** Steam-achievement batch — five items, mirroring the batched sync window. */
export const steamAchievementBatch: Achievement[] = [
  {
    id: '7f3a9c1e-6d2b-4f8a-9c5e-2b1d4e6a8f03',
    externalId: '367520_1',
    gameId: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    name: 'First Landing',
    description: 'Touch down on the survey site.',
    hidden: false,
    iconUrl: 'https://example.com/icons/first-landing.png',
    iconGrayUrl: 'https://example.com/icons/first-landing-grey.png',
    achieved: true,
    unlockedAt: '2026-07-18T21:04:12.000Z',
    globalPercentage: 78.4,
    addedAt: '2026-07-18T21:04:12.000Z',
    updatedAt: '2026-07-18T21:04:12.000Z',
  },
  {
    id: '8a4b0d2f-7e3c-4a9b-8d6e-3c2e5f7a9b04',
    externalId: '367520_2',
    gameId: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    name: 'Cold Signal',
    description: 'Decode the first distress beacon.',
    hidden: false,
    iconUrl: 'https://example.com/icons/cold-signal.png',
    iconGrayUrl: 'https://example.com/icons/cold-signal-grey.png',
    achieved: true,
    unlockedAt: '2026-07-19T13:37:08.000Z',
    globalPercentage: 52.1,
    addedAt: '2026-07-19T13:37:08.000Z',
    updatedAt: '2026-07-19T13:37:08.000Z',
  },
  {
    id: '9b5c1e3a-8f4d-4b1c-9e7f-4d3f6a8b1c05',
    externalId: '367520_3',
    gameId: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    name: 'Deeper Than Map',
    description: 'Reach the third underground stratum.',
    hidden: true,
    iconUrl: 'https://example.com/icons/deeper-than-map.png',
    iconGrayUrl: 'https://example.com/icons/deeper-than-map-grey.png',
    achieved: false,
    unlockedAt: null,
    globalPercentage: null,
    addedAt: '2026-07-22T09:15:00.000Z',
    updatedAt: '2026-07-22T09:15:00.000Z',
  },
  {
    id: '0c6d2f4b-9a5e-4c2d-0f8a-5e4f7b9c2d06',
    externalId: '367520_4',
    gameId: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    name: 'Silent Reactor',
    description: 'Power the dormant core without tripping alarms.',
    hidden: false,
    iconUrl: 'https://example.com/icons/silent-reactor.png',
    iconGrayUrl: 'https://example.com/icons/silent-reactor-grey.png',
    achieved: false,
    unlockedAt: null,
    globalPercentage: 21.8,
    addedAt: '2026-07-22T09:15:00.000Z',
    updatedAt: '2026-07-22T09:15:00.000Z',
  },
  {
    id: '1d7e3a5c-0b6f-4d3e-1a9b-6f5a8c0d3e07',
    externalId: '367520_5',
    gameId: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    name: 'Echo Chamber',
    description: 'Transmit the final recording to orbit.',
    hidden: false,
    iconUrl: 'https://example.com/icons/echo-chamber.png',
    iconGrayUrl: 'https://example.com/icons/echo-chamber-grey.png',
    achieved: true,
    unlockedAt: '2026-07-23T02:51:47.000Z',
    globalPercentage: 33.5,
    addedAt: '2026-07-23T02:51:47.000Z',
    updatedAt: '2026-07-23T02:51:47.000Z',
  },
];

/** Steam library row — the Game shape produced after Valibot validation. */
export const validatedGame: Game = {
  id: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
  externalId: '367520',
  title: 'Deepstar Salvage',
  platform: 'steam',
  status: 'in-progress',
  iconUrl: 'https://example.com/icons/deepstar-salvage.png',
  coverUrl: 'https://example.com/covers/deepstar-salvage.jpg',
  bannerUrl: 'https://example.com/banners/deepstar-salvage.jpg',
  playTime: 18240,
  completionPercentage: 38,
  lastPlayedAt: '2026-07-23T02:51:47.000Z',
  addedAt: '2026-06-30T14:02:11.000Z',
  updatedAt: '2026-07-23T02:51:47.000Z',
};

export interface MappingRow {
  table: 'steam_games' | 'xbox_games' | 'psn_games';
  externalId: string;
  gameId: string;
}

export interface UserGameRow {
  table: 'user_games';
  userId: string;
  gameId: string;
  status: 'in-progress';
  playTime: number;
  completionPercentage: number;
  lastPlayedAt: string;
}

/** Catalog ↔ external-id bindings plus one per-user row. */
export const mappingRows: MappingRow[] = [
  { table: 'steam_games', externalId: '367520', gameId: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b' },
  { table: 'xbox_games', externalId: '9P7Q4V2K1M', gameId: 'b2c3d4e5-0002-4f6a-9b1c-2d3e4f5a6b7c' },
  { table: 'psn_games', externalId: 'EP1234-CUSA45678_00-DEEPSTARSALVAGE', gameId: 'c3d4e5f6-0003-4a7b-8c2d-3e4f5a6b7c8d' },
];

export const userGameRows: UserGameRow[] = [
  {
    table: 'user_games',
    userId: 'u_5f2c9a1e',
    gameId: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    status: 'in-progress',
    playTime: 18240,
    completionPercentage: 38,
    lastPlayedAt: '2026-07-23T02:51:47.000Z',
  },
];

/** Aggregated library stats — total + per-platform breakdown. */
export const statsSample: Stats = {
  total: {
    games: 212,
    completionPercentage: 41.2,
    achievements: 1847,
    completedGames: 73,
  },
  breakdown: {
    steam: {
      games: 118,
      completionPercentage: 46.5,
      achievements: 1042,
      completedGames: 44,
    },
    xbox: {
      games: 61,
      completionPercentage: 34.2,
      achievements: 519,
      completedGames: 19,
    },
    playstation: {
      games: 33,
      completionPercentage: 39.1,
      achievements: 286,
      completedGames: 10,
    },
  },
};

/** Xbox title after IGDB cover enrichment backfill. */
export const enrichedGame: Game = {
  id: 'b2c3d4e5-0002-4f6a-9b1c-2d3e4f5a6b7c',
  externalId: '9P7Q4V2K1M',
  title: 'Hollow Protocol',
  platform: 'xbox',
  status: 'backlog',
  iconUrl: 'https://example.com/icons/hollow-protocol.png',
  coverUrl: 'https://example.com/covers/hollow-protocol-from-igdb.jpg',
  bannerUrl: null,
  playTime: 0,
  completionPercentage: 0,
  lastPlayedAt: null,
  addedAt: '2026-08-01T11:20:00.000Z',
  updatedAt: '2026-08-01T11:26:14.000Z',
};

export interface EnrichmentConfig {
  batchSize: number;
  pauseMs: number;
  enrichedRow: Game;
}

export const enrichmentConfig: EnrichmentConfig = {
  batchSize: 4,
  pauseMs: 1100,
  enrichedRow: enrichedGame,
};
