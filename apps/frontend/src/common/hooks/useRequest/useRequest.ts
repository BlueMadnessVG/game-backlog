import { useCallback, useEffect, useReducer, useRef } from 'react';

import { requestReducer } from './utils/requestReducer.utils';

import type { useRequestOptions, useRequestReturn } from './types/useRequest.type';

/**
 * Hook for handling asynchronous requests with full lifecycle management.
 * * Features:
 * - Atomic state updates via useReducer.
 * - Race condition protection via AbortController.
 * - Callback stability via useRef (prevents infinite loops from inline functions).
 * - Automatic execution based on the `enabled` flag.
 * * @template TData The type of data returned by the service.
 * @template TParams The type of parameters accepted by the service.
 */
export function useRequest<TData, TParams = void>({
  service,
  params,
  enabled = true,
  onSuccess,
  onError,
  onFinally,
}: useRequestOptions<TData, TParams>): useRequestReturn<TData> {
  const [state, dispatch] = useReducer(requestReducer<TData>, {
    data: null,
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const callbacks = useRef({ onSuccess, onError, onFinally });
  callbacks.current = { onSuccess, onError, onFinally };

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const execute = useCallback(async () => {
    if (!enabled) {
      reset();
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    dispatch({ type: 'FETCHING' });

    try {
      const result = await service(params, controller.signal);

      dispatch({ type: 'SUCCESS', payload: result });
      callbacks.current.onSuccess?.(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;

      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      dispatch({ type: 'ERROR', payload: errorMessage });
      callbacks.current.onError?.(err);
    } finally {
      if (abortControllerRef.current === controller) {
        callbacks.current.onFinally?.();
      }
    }
  }, [enabled, params, service, reset]);

  useEffect(() => {
    void execute();
    return () => abortControllerRef.current?.abort();
  }, [execute]);

  return {
    ...state,
    isError: !!state.error,
    refetch: execute,
    reset,
  };
}
