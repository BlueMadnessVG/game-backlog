import { PLATFORM_COLORS } from './platformColors';

import type { HeroButtonKey } from '../store/heroButtonHotspots.Store';

/**
 * Single source of truth for the deep-dive chapters rendered below the hero
 * sequence. Each chapter documents one stage of the sync pipeline and is
 * anchored by an accent color drawn from the PlatformHologram theme tokens so
 * the visual language stays consistent with the 3D controller.
 *
 * `button` maps a chapter to the controller face-button whose platform theme
 * best matches that stage (used by the docked mini-controller glow):
 *   ingest → Steam (the reference provider), normalization/unified-read →
 *   Unified (cross-platform), persistence → PlayStation (deepest mapping
 *   chain), enrichment → Xbox (primary cover target). Security has none —
 *   secrets guard every platform.
 *
 * `redacted` is only used by the Security chapter — it names the secrets that
 * must never reach the browser, rendered as <REDACTED> chips.
 */
export type ChapterId =
  | 'ingest'
  | 'normalization'
  | 'persistence'
  | 'unified-read'
  | 'enrichment'
  | 'security';

export interface Chapter {
  id: ChapterId;
  index: number;
  kicker: string;
  headline: string;
  paragraphs: string[];
  accent: string;
  alignment: 'left' | 'right';
  tag: string;
  button?: HeroButtonKey;
  redacted?: string[];
}

export const SECTIONS: Chapter[] = [
  {
    id: 'ingest',
    index: 1,
    kicker: 'INGEST // PROVIDERS',
    headline: 'Every platform is a separate pipe',
    paragraphs: [
      'Steam, Xbox and PlayStation never share a protocol. Each is wrapped by its own provider — a thin client that owns authentication, URL building and response parsing.',
      'SteamProvider talks to the Steam Web API (GetOwnedGames, GetSchemaForGame). XboxProvider talks to OpenXBL (title history, player stats). PsnProvider wraps the psn-api SDK (profile, titles, trophies). IgdbProvider is used for cover enrichment only.',
    ],
    accent: PLATFORM_COLORS.steam,
    alignment: 'left',
    tag: 'providers/*.provider.ts',
    button: 'cross',
  },
  {
    id: 'normalization',
    index: 2,
    kicker: 'NORMALIZATION // VALIBOT',
    headline: 'Raw JSON never reaches the database unvalidated',
    paragraphs: [
      'Every provider response is parsed with a Valibot schema before it is allowed near the DB. The schema is the trust boundary between what a third-party API returns and what this system believes.',
      'A schema mismatch throws a typed ProviderUnavailableError instead of corrupting rows. Nice-to-have data — like global achievement percentages — fails soft: it is logged and dropped, never fatal.',
    ],
    accent: PLATFORM_COLORS.xbox,
    alignment: 'right',
    tag: 'providers/schemas/*.schemas.ts',
    button: 'circle',
  },
  {
    id: 'persistence',
    index: 3,
    kicker: 'PERSISTENCE // DATA MODEL',
    headline: 'One catalog, three mappings, per-user state',
    paragraphs: [
      'Games live in a single shared catalog keyed on (title, platform) — two users owning the same Steam title share one row.',
      'Per-platform mapping tables (steam_games, xbox_games, psn_games) bind external IDs — appId, titleId, npCommunicationId — back to the catalog.',
      "Everything user-specific — status, play time, completion, last played — is written to user_games, so one user's sync can never overwrite another's.",
    ],
    accent: PLATFORM_COLORS.playstation,
    alignment: 'left',
    tag: 'db/schema/core.ts',
    button: 'square',
  },
  {
    id: 'unified-read',
    index: 4,
    kicker: 'UNIFIED READ // LIBRARY',
    headline: 'Merged at read time, not write time',
    paragraphs: [
      'The LibraryService runs three platform queries in parallel, maps every row to the same Game shape, merges them, and sorts by most-recently-updated.',
      'Achievements are dispatched by the stored platform — steam, xbox or playstation — each resolved through its own service.',
      'Stats are computed per platform and folded into one total: games, completion percentage, achievements and completed count.',
    ],
    accent: PLATFORM_COLORS.unified,
    alignment: 'right',
    tag: 'modules/library/library.services.ts',
    button: 'circle',
  },
];
