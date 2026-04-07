import { parse, type BaseIssue, type BaseSchema } from 'valibot';

import { useRequest } from '../useRequest/useRequest';

/**
 * useSubmit hook for validated data mutations (POST/PUT/DELETE).
 * Integrates Valibot schemas to ensure data integrity before reaching the service layer.
 * * * Features:
 * - Manual Execution: 'enabled' is locked to false; runs only when 'submit' is called.
 * - Valibot Integration: Runtime validation via the provided schema.
 * - Type Inference: Automatically maps TInput and TOutput from the Valibot schema.
 * - Re-throws errors: Allows components to handle specific submission failures.
 *
 * @template TInput The raw input type (usually from a form).
 * @template TOutput The validated output type (what the API receives).
 * @template TSchema The Valibot schema used for parsing.
 * @template TData The success response type from the API.
 *
 * @param {Function} service - The async function that performs the mutation.
 * @param {TSchema} schema - The Valibot schema used to validate 'submit' arguments.
 * @param {Object} [options] - Lifecycle callbacks.
 * @param {Function} [options.onSuccess] - Callback triggered on a successful API response.
 * @param {Function} [options.onError] - Callback triggered on validation or API failure.
 *
 * @returns {Object} An object containing the 'submit' trigger and the current request state.
 *
 *  @example
 * const { submit, isLoading } = useSubmit(api.updateUser, UserSchema, {
 * onSuccess: () => toast.success('Profile updated!')
 * });
 * * // Usage inside an onSubmit handler:
 * // <form onSubmit={handleSubmit(submit)}> ...
 */
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
