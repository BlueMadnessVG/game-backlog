import type { AnchorOptions } from '@/common/components/layout/Assistant';

/**
 * What the assistant cube says and how it feels on the Auth page, spread onto
 * that page's <AssistantAnchor>s. Only one anchor is shown at a time (see
 * AuthManager), so the cube switches lines without re-registering.
 *
 * Exports:
 *  - AUTH_SCRIPT: line + emotion per Auth anchor.
 */
export const AUTH_SCRIPT = {
  login: {
    line: 'Welcome back. Sign in and I will bring your library up.',
    emotion: 'happy',
    priority: 1,
  },
  register: {
    line: 'Make an account, then connect a platform and I will pull your games in.',
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
