import { ApiError, CLIENT_ERROR_CODES } from '@/api/api.client';

/**
 * User-facing text for a failed request: the server's own message when it
 * sent one, otherwise `fallback` (network failures, malformed responses,
 * anything that isn't an {@link ApiError}).
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  const isClientSide = (CLIENT_ERROR_CODES as readonly string[]).includes(error.code);
  if (isClientSide) return fallback;

  // Provider rate limits (503) carry a Retry-After; tell the user when to retry.
  if (error.retryAfter !== undefined && error.retryAfter > 0) {
    return `${error.message} (reintenta en ${error.retryAfter}s)`;
  }
  return error.message;
}
