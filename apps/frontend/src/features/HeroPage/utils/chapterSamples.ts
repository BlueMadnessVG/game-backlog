import { mappingRows, statsSample, steamAchievementBatch, validatedGame } from './sampleData';

import type { Chapter } from './sections';

export interface SamplePanelData {
  title: string;
  code: string;
}

interface SampleEntry {
  title: string;
  code: (chapter: Chapter) => string;
}

const CHAPTER_SAMPLES: Record<string, SampleEntry> = {
  ingest: {
    title: 'providers/steam.provider.ts → achievements.batch[5]',
    code: () => JSON.stringify(steamAchievementBatch, null, 2),
  },
  normalization: {
    title: 'v.parse(GameSchema, rawProviderPayload)',
    code: () => JSON.stringify(validatedGame, null, 2),
  },
  persistence: {
    title: 'db/schema/core.ts — mapping + per-user rows',
    code: () => JSON.stringify([...mappingRows], null, 2),
  },
  'unified-read': {
    title: 'GET /api/stats — merged at read time',
    code: () => JSON.stringify(statsSample, null, 2),
  },
  security: {
    title: '.env — server-side only',
    code: (chapter) => (chapter.redacted ?? []).map((key) => `${key}=<REDACTED>`).join('\n'),
  },
};

export function getChapterSample(chapter: Chapter): SamplePanelData {
  const entry = CHAPTER_SAMPLES[chapter.id];
  return {
    title: entry.title,
    code: entry.code(chapter),
  };
}
