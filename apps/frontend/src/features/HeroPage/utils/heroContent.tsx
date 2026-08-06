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
    body: 'Batched/chunked delivery ensuring seamless integration with Microsoft ecosystem.',
    tag: 'SYSTEM_STABLE_REV_4.0',
  },
  {
    key: 'steam',
    label: 'STEAM INTEGRATION',
    body: 'TanStack Virtual library handling massive game catalogues with minimal DOM overhead.',
  },
  {
    key: 'playstation',
    label: 'PLAYSTATION NETWORK',
    body: 'Legacy trophy synchronization mapping historical achievement data efficiently.',
  },
  {
    key: 'unified',
    label: 'UNIFIED PERSISTENCE',
    body: 'Valibot schema validation ensuring cross-platform data normalization integrity.',
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
