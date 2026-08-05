/** Static HUD copy — keep components purely presentational. */
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
