/**
 * Reduced-motion helpers.
 *
 * Exports:
 *  - prefersReducedMotion: the current OS setting (safe outside a browser).
 *  - subscribeReducedMotion: calls back whenever the OS setting changes.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

/** Returned when there is nothing to unsubscribe from (no matchMedia). */
function noop(): void {
  // Nothing was subscribed.
}

/** True when the OS asks for reduced motion. Safe to call outside a browser. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** Calls `onChange` with the new value whenever the OS setting changes. Returns an unsubscribe. */
export function subscribeReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return noop;
  const media = window.matchMedia(QUERY);
  const listener = (e: MediaQueryListEvent) => onChange(e.matches);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
