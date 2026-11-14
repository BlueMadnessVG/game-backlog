import type { Emotion } from '../store/assistant.Store';

/**
 * What the assistant cube says and how it feels about each moment of the
 * page. The face reacts to every section; the speech bubble only shows the
 * section lines (platform beats are explained by the part callouts).
 *
 * Exports:
 *  - SECTION_SCRIPT: line + emotion per below-the-hero section id.
 *  - IDLE_HINT: what the cube says when clicked with nothing to add.
 */
export type SectionId = 'stock' | 'anatomy' | 'cta';

export const SECTION_SCRIPT: Record<SectionId, { line: string; emotion: Emotion }> = {
  stock: {
    line: 'This is a sample library. Connect your platforms and these numbers become yours.',
    emotion: 'happy',
  },
  anatomy: {
    line: 'Every game passes through six steps. Pick one and I will show you where it sits.',
    emotion: 'think',
  },
  cta: {
    line: 'Your library is ready when you are.',
    emotion: 'happy',
  },
};

export const IDLE_HINT = 'Soon you will be able to ask me about your library.';
