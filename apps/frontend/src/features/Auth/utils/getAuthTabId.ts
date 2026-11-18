import type { AuthMode } from '../Auth.types';

/** Stable id for an auth tab, so the tab panel can reference the selected tab via `aria-labelledby`. */
export const getAuthTabId = (idPrefix: string, mode: AuthMode) => `${idPrefix}-tab-${mode}`;
