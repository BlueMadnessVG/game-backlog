import type { Emotion } from '../store/assistant.Store';

/**
 * Module-level registry of the `<AssistantAnchor>` elements currently
 * mounted. Anchors write themselves in (and keep `visible` up to date from an
 * IntersectionObserver); the rig reads it every frame. Kept outside React and
 * zustand state on purpose: registering or scrolling never re-renders anything.
 *
 * Exports:
 *  - AnchorOptions: what a page can say about an anchor.
 *  - AnchorEntry: a registered anchor.
 *  - anchorRegistry: set / remove / values.
 */
export interface AnchorOptions {
  /** What the cube says while docked here (null for nothing). */
  line?: string | null;
  /** The face while docked here (defaults to idle). */
  emotion?: Emotion;
  /** Higher wins over a nearer anchor; ties go to the one nearest the centre. */
  priority?: number;
}

export interface AnchorEntry extends AnchorOptions {
  id: string;
  el: HTMLElement;
  /** Near or inside the scrollport (IntersectionObserver, with a margin). */
  visible: boolean;
}

const entries = new Map<string, AnchorEntry>();

export const anchorRegistry = {
  set(entry: AnchorEntry) {
    entries.set(entry.id, entry);
  },
  /** Removes `id` only if it still belongs to `el` (a remount may have replaced it). */
  remove(id: string, el: HTMLElement) {
    if (entries.get(id)?.el === el) entries.delete(id);
  },
  values(): Iterable<AnchorEntry> {
    return entries.values();
  },
};
