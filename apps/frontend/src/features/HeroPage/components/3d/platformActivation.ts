import type { PlatformKey } from '../../utils/platformColors';

/**
 * Hero-only per-platform activation (0..1), written by AssistantRig from the
 * scroll timeline and read by the cube's corner lights. Module-level so
 * neither side re-renders when it changes.
 *
 * Exports:
 *  - platformActive: one `{ current }` cell per platform.
 */
export const platformActive: Record<PlatformKey, { current: number }> = {
  steam: { current: 0 },
  xbox: { current: 0 },
  playstation: { current: 0 },
  unified: { current: 0 },
};
