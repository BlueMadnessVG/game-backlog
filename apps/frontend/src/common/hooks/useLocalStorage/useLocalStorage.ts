import { useSyncExternalStore, useCallback } from 'react';

/**
 * useLocalStorage hook
 * Syncs state with window.localStorage using the React 18+ useSyncExternalStore API.
 * * Features:
 * - Cross-tab synchronization (updates all tabs on change).
 * - SSR safety (prevents hydration mismatches).
 * - Type-safe generics.
 * - Support for functional updates (e.g., setState(prev => !prev)).
 *
 * @param key The key to store in localStorage
 * @param initialValue The fallback value if none exists
 *
 * @example
 * const [name, setName] = useLocalStorage<string>('user-name', 'Anonymous');
 * * // Simple update
 * setName('John Doe');
 * * // Functional update
 * setName((prev) => prev.toUpperCase());
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const subscribe = useCallback(
    (callback: () => void) => {
      window.addEventListener('storage', (e) => {
        if (e.key === key) callback();
      });
      return () => window.removeEventListener('storage', callback);
    },
    [key],
  );

  const getSnapshot = () => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const getServerSnapshot = () => initialValue;
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setStorageValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const nextValue = value instanceof Function ? value(store) : value;
        window.localStorage.setItem(key, JSON.stringify(nextValue));
        window.dispatchEvent(new StorageEvent('storage', { key }));
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, store],
  );

  return [store, setStorageValue] as const;
}
