import { PLATFORM_COLORS } from './platformColors';

/**
 * The four part callouts shown during the hero's platform beats. Each one
 * documents a stage of the backend sync pipeline (apps/backend) and names the
 * objects that stage is built from. The accent comes from PLATFORM_COLORS so
 * it matches the cube's corner light for that beat.
 *
 * Exports:
 *  - ChapterId: union of the four pipeline-stage ids.
 *  - Chapter: shape of one callout (copy, objects, accent, side, source path).
 *  - SECTIONS: the ordered Chapter[]; `index` matches the timeline's display.
 */
export type ChapterId = 'ingest' | 'normalization' | 'persistence' | 'unified-read';

export interface Chapter {
  id: ChapterId;
  index: number;
  /** Short sentence-case name of the pipeline stage. */
  part: string;
  headline: string;
  paragraphs: string[];
  /** Backend classes, types and tables this stage uses (shown as chips). */
  objects: string[];
  accent: string;
  alignment: 'left' | 'right';
  /** Where the stage lives in apps/backend. */
  tag: string;
}

export const SECTIONS: Chapter[] = [
  {
    id: 'ingest',
    index: 1,
    part: 'Ingest',
    headline: 'Every platform is its own provider',
    paragraphs: [
      'SteamProvider calls the Steam Web API with a key (GetOwnedGames, GetPlayerAchievements, GetSchemaForGame), XboxProvider calls OpenXBL with an X-Authorization header, and PsnProvider wraps the psn-api SDK with tokens exchanged from an NPSSO. Each one owns its auth, URLs and HTTP-error mapping.',
      'A PlatformAdapter sits on each provider — SteamAdapter, XboxAdapter, PsnAdapter — and turns its responses into one OwnedGame and NormalizedAchievement shape, with its own batch size and pause so a full achievement sync stays under that API’s rate limit.',
    ],
    objects: [
      'SteamProvider',
      'XboxProvider',
      'PsnProvider',
      'PlatformAdapter',
      'SteamAdapter',
      'XboxAdapter',
      'PsnAdapter',
      'OwnedGame',
      'NormalizedAchievement',
    ],
    accent: PLATFORM_COLORS.steam,
    alignment: 'left',
    tag: 'modules/platforms/*.adapter.ts',
  },
  {
    id: 'normalization',
    index: 2,
    part: 'Normalization',
    headline: 'Nothing is trusted until it parses',
    paragraphs: [
      'Every response goes through v.safeParse against a Valibot schema — SteamOwnedGamesResponseSchema, XboxTitleHistorySchema, IgdbGamesResponseSchema and the rest — before it can reach the database.',
      'Failures become typed errors: ProviderAuthError, ProviderRateLimitError (sent with Retry-After) and ProviderUnavailableError. Required calls throw; nice-to-have data like global percentages, Xbox playtime or IGDB covers is logged and dropped. deriveGameStatus then files each game as backlog, in-progress, completed or retired.',
    ],
    objects: [
      'Valibot schemas',
      'ProviderAuthError',
      'ProviderRateLimitError',
      'ProviderUnavailableError',
      'AppError',
      'deriveGameStatus',
    ],
    accent: PLATFORM_COLORS.xbox,
    alignment: 'right',
    tag: 'providers/schemas/*.schemas.ts',
  },
  {
    id: 'persistence',
    index: 3,
    part: 'Persistence',
    headline: 'One shared catalog, per-user state on top',
    paragraphs: [
      'games and achievements are a shared catalog keyed on (platform, external_id) — a Steam appid, Xbox titleId or PSN npCommunicationId — so two users who own the same title share one row. Each user’s status, play time, completion and unlock dates live in user_games and user_achievements.',
      'steam_accounts, xbox_accounts and psn_accounts only link a user to a platform; PSN tokens are encrypted with AES-256-GCM. PlatformLibrary writes each sync in one transaction under a Postgres advisory lock (withLock), so a user’s syncs never overlap.',
    ],
    objects: [
      'games',
      'achievements',
      'user_games',
      'user_achievements',
      '*_accounts',
      'PlatformLibrary',
      'withLock',
      'encrypt / decrypt',
    ],
    accent: PLATFORM_COLORS.playstation,
    alignment: 'left',
    tag: 'db/schema/*.ts',
  },
  {
    id: 'unified-read',
    index: 4,
    part: 'Unified read',
    headline: 'Merged at read time, not write time',
    paragraphs: [
      'LibraryService serves the library from one query that joins user_games to games across every platform — filtered, newest-updated first and paged. getStats runs two per-platform queries in parallel (games and achievements) and folds them into one total.',
      'Achievement requests are dispatched to the PlatformLibrary for the game’s stored platform. Everything is served by Hono under /api/v1, behind the auth middleware: a session cookie or a bkl_ API token.',
    ],
    objects: [
      'LibraryService',
      'PlatformLibrary',
      'Game',
      'Stats',
      'Hono /api/v1',
      'createAuthMiddleware',
    ],
    accent: PLATFORM_COLORS.unified,
    alignment: 'right',
    tag: 'modules/library/library.services.ts',
  },
];
