/**
 * Global Design Tokens for Breakpoints.
 * Using numbers allows for mathematical comparisons (e.g., breakpoint + 1).
 */
export const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
} as const;

/**
 * Helper to generate standardized Media Query strings.
 * This prevents "stringly-typed" errors across the app.
 */
export const QUERIES = {
  isMobile: `(max-width: ${BREAKPOINTS.tablet - 1}px)`,
  isTablet: `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`,
  isDesktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
  isTabletOrLarger: `(min-width: ${BREAKPOINTS.tablet}px)`,
} as const;
