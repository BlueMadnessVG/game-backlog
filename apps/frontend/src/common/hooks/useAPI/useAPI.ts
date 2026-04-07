import { useRequest } from '../useRequest/useRequest';

/**
 * useAPI hook for declarative data fetching (GET).
 * A specialized wrapper around useRequest designed for automatic execution.
 * * * Features:
 * - Automatic execution on mount/dependency change.
 * - Refresh capability via aliased 'refetch' function.
 * - Inherits AbortController and atomic state from useRequest.
 *
 * @template TData The type of data returned by the service.
 * @template TParams The type of parameters accepted by the service.
 *
 * @param {Function} service - The async function to fetch data.
 * @param {TParams} params - The arguments to pass to the service.
 * @param {Object} [options] - Configuration options.
 * @param {boolean} [options.enabled=true] - If false, the request won't trigger automatically.
 *
 * @returns {useRequestReturn<TData, TParams> & { refresh: Function }}
 *
 * The request state plus a 'refresh' method.
 * * @example
 * const { data, isLoading, refresh } = useAPI(userService.getProfile, { id: 1 });
 */
export function useAPI<TData, TParams>(
  service: (params: TParams, signal?: AbortSignal) => Promise<TData>,
  params: TParams,
  options?: { enabled?: boolean },
) {
  const request = useRequest<TData, TParams>({
    service,
    params,
    enabled: options?.enabled ?? true,
  });

  return {
    ...request,
    refresh: request.refetch,
  };
}
