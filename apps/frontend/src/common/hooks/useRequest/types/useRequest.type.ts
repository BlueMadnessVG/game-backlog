export interface State<TData> {
  data: TData | null;
  isLoading: boolean;
  error: string | null;
  isSuccess: boolean;
}

export type Action<TData> =
  | { type: 'FETCHING' }
  | { type: 'SUCCESS'; payload: TData }
  | { type: 'ERROR'; payload: string }
  | { type: 'RESET' };

export interface useRequestOptions<TData, TParams> {
  service: (params: TParams, signal?: AbortSignal) => Promise<TData>;
  params: TParams;
  enabled?: boolean;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
  onFinally?: () => void;
}

export interface useRequestReturn<TData, TParams> {
  data: TData | null;
  isLoading: boolean;
  error: string | null;
  isSuccess: boolean;
  isError: boolean;
  refetch: (overrideParams?: TParams) => Promise<TData | undefined>;
  reset: () => void;
}
