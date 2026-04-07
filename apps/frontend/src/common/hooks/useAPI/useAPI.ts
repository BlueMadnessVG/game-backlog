import { useRequest } from '../useRequest/useRequest';

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
