import { useCallback, useEffect, useReducer, useRef } from 'react';

import { requestReducer } from './utils/requestReducer.utils';

import type { useRequestOptions, useRequestReturn } from './types/useRequest.type';

/**
 * Hook for handling asynchronous requests with full lifecycle management.
 * * Features:
 * - Atomic state updates via useReducer (prevents impossible states).
 * - Race condition protection via AbortController (cancels previous pending requests).
 * - Callback stability via useRef (prevents infinite loops from inline functions).
 * - Automatic execution based on the `enabled` flag.
 *
 * @template TData The type of data returned by the service.
 * @template TParams The type of parameters accepted by the service.
 *
 * @param {useRequestOptions<TData, TParams>} options - Configuration options for the request.
 * @param {Function} options.service - The async function to execute. Receives params and an AbortSignal.
 * @param {TParams} options.params - Arguments passed to the service function.
 * @param {boolean} [options.enabled=true] - If false, the request won't trigger automatically.
 * @param {Function} [options.onSuccess] - Callback triggered on successful resolution.
 * @param {Function} [options.onError] - Callback triggered when the service throws an error.
 * @param {Function} [options.onFinally] - Callback triggered after the request completes (success or error).
 *
 * @returns {useRequestReturn<TData>} The current state, data, and control functions (refetch, reset).
 *
 * @example
 * interface User { id: number; name: string; }
 * const { data, isLoading, isError, refetch } = useRequest<User, number>({
 * service: (id, signal) => userService.getById(id, signal),
 * params: 123,
 * enabled: !!userId,
 * onSuccess: (user) => console.log(`Loaded ${user.name}`),
 * onError: (err) => toast.error(err.message)
 * });
 */
export function useRequest<TData, TParams>({
  service,
  params: initialParams,
  enabled = true,
  onSuccess,
  onError,
  onFinally,
}: useRequestOptions<TData, TParams>): useRequestReturn<TData, TParams> {
  const [state, dispatch] = useReducer(requestReducer<TData>, {
    data: null,
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const callbacks = useRef({ onSuccess, onError, onFinally });
  callbacks.current = { onSuccess, onError, onFinally };
  const serviceRef = useRef(service);
  serviceRef.current = service;

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const execute = useCallback(
    async (overrideParams?: TParams): Promise<TData | undefined> => {
      if (!enabled) {
        reset();
        return undefined;
      }

      const currentParams = overrideParams ?? initialParams;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      dispatch({ type: 'FETCHING' });

      try {
        const result = await serviceRef.current(currentParams, controller.signal);

        dispatch({ type: 'SUCCESS', payload: result });

        callbacks.current.onSuccess?.(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return undefined;

        const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
        dispatch({ type: 'ERROR', payload: errorMessage });
        callbacks.current.onError?.(err);
        return undefined;
      } finally {
        if (abortControllerRef.current === controller) {
          callbacks.current.onFinally?.();
        }
      }
    },
    [enabled, initialParams, reset],
  );

  useEffect(() => {
    if (!enabled) return;
    void execute();
    return () => abortControllerRef.current?.abort();
  }, [execute, enabled]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isSuccess: state.isSuccess,
    isError: !!state.error,
    refetch: execute,
    reset,
  };
}
