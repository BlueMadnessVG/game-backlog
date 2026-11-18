import type { Emotion } from '@/common/components/layout/Assistant';

/**
 * What the assistant cube says and how it feels about each moment of the
 * page. The face reacts to every section; the speech bubble only shows the
 * section lines (platform beats are explained by the part callouts).
 *
 * Exports:
 *  - SECTION_SCRIPT: line + emotion per below-the-hero section, spread onto
 *    that section's <AssistantAnchor>.
 *  (The click hint with no line lives in the shared assistant store.)
 */
export const SECTION_SCRIPT = {
  stock: {
    line: 'This is a sample library. Connect your platforms and these numbers become yours.',
    emotion: 'happy',
  },
  anatomy: {
    line: 'Every game passes through six steps. Pick one and I will show you where it sits.',
    emotion: 'think',
  },
  sync: {
    line: 'Press sync once. I save your games first, then keep fetching achievements in the background.',
    emotion: 'think',
  },
  trust: {
    line: 'I only keep what a sync needs. Keys and secrets never leave the server.',
    emotion: 'happy',
  },
  cta: {
    line: 'Your library is ready when you are.',
    emotion: 'happy',
  },
} satisfies Record<string, { line: string; emotion: Emotion }>;
