import type { AnchorOptions } from '@/common/components/layout/Assistant';

/**
 * What the assistant cube says and how it feels on the Auth page, spread onto
 * that page's <AssistantAnchor>s. Only one anchor is shown at a time (see
 * AuthManager), so the cube switches lines without re-registering.
 *
 * Keep each line short enough for one line (~26 characters): on desktop the
 * bubble opens on the cube's left, between the panel and the cube, and a
 * wrapped line grows to the full bubble width and covers the heading's lede.
 *
 * Exports:
 *  - AUTH_SCRIPT: line + emotion per Auth anchor.
 */
export const AUTH_SCRIPT = {
  login: {
    line: 'Welcome back.',
    emotion: 'happy',
    priority: 1,
  },
  register: {
    line: "Let's set up your account.",
    emotion: 'happy',
    priority: 1,
  },
  /** While a password field has focus. */
  password: {
    line: 'Not looking.',
    emotion: 'sleep',
    priority: 1,
  },
} satisfies Record<string, AnchorOptions>;
