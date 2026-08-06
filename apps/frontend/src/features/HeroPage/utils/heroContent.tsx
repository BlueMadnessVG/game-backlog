import type { PlatformKey } from './platformColors';

export interface FeatureCallout {
  key: PlatformKey;
  label: string;
  body: string;
  tag?: string;
}

export const featureCallouts: FeatureCallout[] = [
  {
    key: 'xbox',
    label: 'XBOX SYNC',
    body: 'Title history pulled via OpenXBL, achievements synced in batches of five with a 500ms pause; failures are skipped, not retried.',
    tag: 'xbox.provider.ts',
  },
  {
    key: 'steam',
    label: 'STEAM INTEGRATION',
    body: 'Library pulled from the Steam Web API and filtered to titles with visible stats; achievements batched in fives with a 200ms pause.',
    tag: 'steam.provider.ts',
  },
  {
    key: 'playstation',
    label: 'PLAYSTATION NETWORK',
    body: 'Synced through the psn-api SDK, with PSN access tokens refreshed automatically 60s before expiry.',
    tag: 'psn.provider.ts',
  },
  {
    key: 'unified',
    label: 'UNIFIED PERSISTENCE',
    body: 'One shared catalog keyed on title and platform; three platform queries run in parallel and merge into a single sorted list.',
    tag: 'library.services.ts',
  },
];

export const hudChromeContent = {
  coreLabel: 'BACKLOG // CORE',
  libraries: 5,
  platforms: 3,
  syncStatus: 'LIVE',
  latencyMs: 12,
  vramStatus: 'OPTIMIZED',
  scrollSequenceVersion: 'V2.0.4',
} as const;

export function deriveHudCoordinates(progress: number) {
  return {
    x: (progress * 180 + 20).toFixed(1),
    y: (Math.sin(progress * Math.PI) * 90 + 10).toFixed(1),
    z: (progress * 2.6).toFixed(1),
  };
}
