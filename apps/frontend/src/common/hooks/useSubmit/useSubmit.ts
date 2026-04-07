import { parse, type BaseIssue, type BaseSchema } from 'valibot';

import { useRequest } from '../useRequest/useRequest';

export function useSubmit<
  TInput,
  TOutput,
  TSchema extends BaseSchema<TInput, TOutput, BaseIssue<TInput>>,
  TData,
>(
  service: (data: TOutput) => Promise<TData>,
  schema: TSchema,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: unknown) => void;
  },
) {
  const request = useRequest<TData, TOutput>({
    service,
    params: undefined as unknown as TOutput,
    enabled: false,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });

  const { refetch, isLoading, error, data } = request;

  const submit = async (values: TInput): Promise<TData | undefined> => {
    try {
      const validatedData = parse(schema, values);

      if (typeof refetch !== 'function') {
        throw new Error('Request engine failed to initialize');
      }

      return await refetch(validatedData);
    } catch (err: unknown) {
      options?.onError?.(err);
      throw err;
    }
  };

  return { submit, isLoading, error, data };
}
