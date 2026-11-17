import type { Stats } from '@repo/shared';

/**
 * Static sample data for the HeroPage part callouts and the stock list.
 *
 * Everything here is fabricated — fake titles, ids and numbers — but each
 * object is shaped like the backend value it documents, so the panels show
 * real structure without touching user data. Nothing is fetched at runtime.
 *
 * Exports:
 *  - ownedGameSample: an `OwnedGame` as a platform adapter returns it
 *    (apps/backend/modules/platforms/platform-adapter.ts).
 *  - rateLimitErrorSample: the JSON body error.handler.ts sends for a
 *    ProviderRateLimitError.
 *  - catalogRowsSample: one shared `games` catalog row and the `user_games`
 *    row that holds one user's state for it.
 *  - statsSample: aggregated library stats (total + per-platform).
 */

/** `SteamAdapter.fetchOwnedGames` output — the platform-neutral OwnedGame shape. */
export const ownedGameSample = {
  externalId: '367520',
  title: 'Deepstar Salvage',
  iconUrl: 'https://example.com/icons/deepstar-salvage.png',
  coverUrl: 'https://example.com/covers/deepstar-salvage.jpg',
  bannerUrl: null,
  playTimeMinutes: 18240,
  lastPlayedAt: '2026-07-23T02:51:47.000Z',
  completionPercentage: null,
  metadata: {},
};

/** HTTP 503 body (with `Retry-After: 60`) for a rate-limited provider call. */
export const rateLimitErrorSample = {
  status: 'ERROR',
  code: 'PROVIDER_RATE_LIMITED',
  message: 'The game platform is rate limiting us. Try again in a minute.',
  requestId: '4c1f8e2a-9b7d-4e3a-8f6c-2d5b1a9e7c30',
};

/** One shared catalog row plus the per-user row that points at it. */
export const catalogRowsSample = {
  games: {
    id: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    platform: 'steam',
    external_id: '367520',
    title: 'Deepstar Salvage',
    has_achievements: true,
  },
  user_games: {
    user_id: 'f0e1d2c3-0009-4b8a-9c7d-6e5f4a3b2c1d',
    game_id: 'a1b2c3d4-0001-4e5f-8a9b-1c2d3e4f5a6b',
    status: 'in-progress',
    play_time: 18240,
    completion_percentage: 38,
    last_played_at: '2026-07-23T02:51:47.000Z',
  },
};

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
