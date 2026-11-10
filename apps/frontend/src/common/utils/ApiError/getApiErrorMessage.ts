import { ApiError, CLIENT_ERROR_CODES } from '@/api/api.client';

/**
 * User-facing text for a failed request: the server's own message when it
 * sent one, otherwise `fallback` (network failures, malformed responses,
 * anything that isn't an {@link ApiError}).
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  const isClientSide = (CLIENT_ERROR_CODES as readonly string[]).includes(error.code);
  return isClientSide ? fallback : error.message;
}
