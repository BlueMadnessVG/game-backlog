import {
  catalogRowsSample,
  ownedGameSample,
  rateLimitErrorSample,
  statsSample,
} from './sampleData';

import type { Chapter, ChapterId } from './sections';

/**
 * Maps each part callout to the sample payload it shows, from ./sampleData.
 *
 * Exports:
 *  - SamplePanelData: { title, code } shape handed to the panel renderer.
 *  - getChapterSample(chapter): the sample for a Chapter.
 */
export interface SamplePanelData {
  title: string;
  code: string;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

const CHAPTER_SAMPLES: Record<ChapterId, SamplePanelData> = {
  ingest: {
    title: 'SteamAdapter.fetchOwnedGames → OwnedGame',
    code: json(ownedGameSample),
  },
  normalization: {
    title: 'ProviderRateLimitError → 503',
    code: json(rateLimitErrorSample),
  },
  persistence: {
    title: 'games + user_games rows',
    code: json(catalogRowsSample),
  },
  'unified-read': {
    title: 'GET /api/v1/library/stats',
    code: json(statsSample),
  },
};

export function getChapterSample(chapter: Chapter): SamplePanelData {
  return CHAPTER_SAMPLES[chapter.id];
}
