import type { AnchorOptions } from '@/common/components/layout/Assistant';

/**
 * What the assistant cube says and how it feels on the Library page, spread
 * onto that spot's <AssistantAnchor>.
 *
 * Exports:
 *  - LIBRARY_SCRIPT: line + emotion per Library anchor.
 */
export const LIBRARY_SCRIPT = {
  /** Beside the page title, while it is on screen. */
  header: {
    line: 'Every game from every platform you connected, in one place. Pick one to see its achievements.',
    emotion: 'happy',
    priority: 1,
  },
  /** Small corner dock once the title scrolls away. */
  corner: {
    line: 'Scroll on, I will keep watch from here.',
    emotion: 'idle',
  },
  /** Corner dock while the library is loading. */
  loading: {
    line: 'One moment, I am loading your library.',
    emotion: 'think',
  },
  /** Empty library. */
  empty: {
    line: 'Nothing here yet. Connect a platform and I will pull your games in.',
    emotion: 'think',
  },
} satisfies Record<string, AnchorOptions>;
