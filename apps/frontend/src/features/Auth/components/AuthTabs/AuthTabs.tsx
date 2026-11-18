import { useEffect, useRef } from 'react';

import styles from './css/AuthTabs.module.css';
import { getAuthTabId } from '../../utils/getAuthTabId';

import type { AuthMode } from '../../Auth.types';

interface AuthTabsProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
  /** Per-instance prefix (from `useId`) so the tab panel can reference the selected tab. */
  idPrefix: string;
}

const TABS: { id: AuthMode; label: string }[] = [
  { id: 'login', label: 'Sign in' },
  { id: 'register', label: 'Create account' },
];

/**
 * Arrow-key navigation comes from the native `focusgroup` attribute
 * (`tablist nomemory`: focus entering the group always lands on the selected tab).
 * Browsers without it get `@microsoft/focusgroup-polyfill`, loaded on demand.
 * Selection follows focus, so arrowing to a tab also selects it.
 */
export const AuthTabs = ({ mode, onChange, idPrefix }: AuthTabsProps) => {
  const tablistRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tablist = tablistRef.current;
    if (!tablist || Object.hasOwn(HTMLElement.prototype, 'focusGroup')) return;

    let cancelled = false;
    void import('@microsoft/focusgroup-polyfill').then(({ polyfill }) => {
      if (!cancelled) polyfill(tablist);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={tablistRef}
      className={styles.tabs}
      role="tablist"
      aria-label="Account"
      {...({ focusgroup: 'tablist nomemory' } as object)}
    >
      {TABS.map((tab) => {
        const selected = mode === tab.id;
        return (
          <button
            key={tab.id}
            id={getAuthTabId(idPrefix, tab.id)}
            role="tab"
            aria-selected={selected}
            type="button"
            className={styles.tab}
            onFocus={() => onChange(tab.id)}
            onClick={() => onChange(tab.id)}
            {...(selected ? ({ focusgroupstart: '' } as object) : {})}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
