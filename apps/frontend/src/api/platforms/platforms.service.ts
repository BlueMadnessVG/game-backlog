import {
  AchievementsResponseSchema,
  GameSchema,
  GamesResponseSchema,
  PsnSyncResultSchema,
  SteamSyncResultSchema,
  XboxSyncResultSchema,
  type AchievementFilter,
  type AchievementSort,
  type AchievementsResponse,
  type Game,
  type GamesResponse,
  type Platform,
  type PlatformRoute,
  type PsnSyncInput,
  type PsnSyncResult,
  type SteamSyncInput,
  type SteamSyncResult,
  type XboxSyncInput,
  type XboxSyncResult,
} from '@repo/shared';

import {
  envelope,
  messageEnvelope,
  MessageResponseSchema,
  request,
  type MessageResponse,
} from '../api.client';

import type * as v from 'valibot';

// ── Types ─────────────────────────────────────────────────────────────────────

/** What each `POST /{platform}/sync` takes and returns, keyed by URL segment. */
export interface PlatformSyncMap {
  steam: { input: SteamSyncInput; result: SteamSyncResult };
  xbox: { input: XboxSyncInput; result: XboxSyncResult };
  psn: { input: PsnSyncInput; result: PsnSyncResult };
}

export type PlatformSyncResponse<P extends PlatformRoute> = PlatformSyncMap[P]['result'] & {
  message: string | undefined;
};

export interface PlatformPageParams {
  /** Default 50, max 100. */
  limit?: number;
  offset?: number;
}

export interface PlatformAchievementsParams extends PlatformPageParams {
  filter?: AchievementFilter;
  sort?: AchievementSort;
}

const SYNC_RESPONSE_SCHEMAS: { [P in PlatformRoute]: v.GenericSchema<unknown, PlatformSyncMap[P]['result']> } = {
  steam: SteamSyncResultSchema,
  xbox: XboxSyncResultSchema,
  psn: PsnSyncResultSchema,
};

const GameResponseSchema = envelope(GameSchema);

/**
 * Maps a game's `platform` field to its router's URL segment
 * (`playstation` → `psn`). `null` for platforms without a router.
 */
export function toPlatformRoute(platform: Platform): PlatformRoute | null {
  switch (platform) {
    case 'steam':
      return 'steam';
    case 'xbox':
      return 'xbox';
    case 'playstation':
      return 'psn';
    default:
      return null;
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * The per-platform routers mounted at `/api/v1/{steam|xbox|psn}`. Library-wide
 * reads (`/library/*`) live in `libraryService`; prefer those in the UI.
 */
export const platformsService = {
  /** `GET /{platform}/games` — the library restricted to one platform. */
  getGames(
    platform: PlatformRoute,
    params?: PlatformPageParams,
    signal?: AbortSignal,
  ): Promise<GamesResponse> {
    return request(GamesResponseSchema, {
      path: `/${platform}/games`,
      query: { limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
      signal,
    });
  },

  /** `GET /{platform}/games/:id` — 404 `GAME_NOT_FOUND` if it isn't on that platform. */
  async getGame(platform: PlatformRoute, id: string, signal?: AbortSignal): Promise<Game> {
    const response = await request(GameResponseSchema, {
      path: `/${platform}/games/${encodeURIComponent(id)}`,
      signal,
    });
    return response.data;
  },

  /**
   * `POST /{platform}/sync` — links the account and imports its library.
   * Achievements keep syncing in the background after this returns.
   */
  async sync<P extends PlatformRoute>(
    platform: P,
    input: PlatformSyncMap[P]['input'],
  ): Promise<PlatformSyncResponse<P>> {
    const schema: v.GenericSchema<unknown, PlatformSyncMap[P]['result']> =
      SYNC_RESPONSE_SCHEMAS[platform];
    const response = await request(messageEnvelope(schema), {
      method: 'POST',
      path: `/${platform}/sync`,
      body: input,
    });
    return { ...response.data, message: response.message };
  },

  /** `POST /{platform}/games/:gameId/sync-achievements` */
  syncAchievements(platform: PlatformRoute, gameId: string): Promise<MessageResponse> {
    return request(MessageResponseSchema, {
      method: 'POST',
      path: `/${platform}/games/${encodeURIComponent(gameId)}/sync-achievements`,
    });
  },

  /**
   * `POST /{platform}/games/:gameId/achievements` — a read the backend
   * exposes as POST; options travel in the query string, there is no body.
   * The UI uses `libraryService.getAchievements` (a GET) instead.
   */
  getAchievements(
    platform: PlatformRoute,
    gameId: string,
    params?: PlatformAchievementsParams,
    signal?: AbortSignal,
  ): Promise<AchievementsResponse> {
    return request(AchievementsResponseSchema, {
      method: 'POST',
      path: `/${platform}/games/${encodeURIComponent(gameId)}/achievements`,
      query: { ...params, limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
      signal,
    });
  },
};
