import { useCallback, useEffect, useRef } from 'react';

type AnyFunction = (...args: never[]) => unknown;

/**
 * useDebouncedCallback hook
 * Delays the execution of a function until after a specific delay.
 * * Features:
 * - Persistent reference: No stale closures (always uses the latest callback).
 * - Automatic cleanup: Clears pending timers on unmount or delay change.
 * - Precision typing: Uses Parameters<T> to preserve exact argument types.
 *
 * @param callback The function to be debounced.
 * @param delay Time in milliseconds to wait before execution.
 *
 * @example
 * const handleSearch = useDebouncedCallback((query: string) => {
 * fetchResults(query);
 * }, 300);
 *
 * <input onChange={(e) => handleSearch(e.target.value)} />
 */
export function useDebouncedCallback<T extends AnyFunction>(callback: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return cancel;
  }, [cancel, delay]);

  return { run: debouncedFn, cancel };
}
