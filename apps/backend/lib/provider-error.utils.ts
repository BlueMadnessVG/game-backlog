import { AppError } from "./errors";

/**
 * Failures of an upstream platform API (Steam, OpenXBL, PSN, IGDB, …).
 *
 * To our client these are never its own fault and never an authentication
 * problem: if a platform rejects OUR API key that is a 502, not a 401 (the
 * frontend logs the user out on 401). The raw messages carry provider detail
 * (status lines, key names), so they stay in the log and the client gets a
 * fixed sentence.
 */

export class ProviderAuthError extends AppError {
  readonly status = 502;
  readonly code = "PROVIDER_AUTH_FAILED";

  constructor(
    provider: string,
    message = "Invalid or expired credentials",
    options?: ErrorOptions,
  ) {
    super(`[${provider}] ${message}`, options);
  }

  override get publicMessage() {
    return "The game platform rejected our request. Try again later.";
  }
}

export class ProviderRateLimitError extends AppError {
  readonly status = 503;
  readonly code = "PROVIDER_RATE_LIMITED";
  override readonly headers = { "Retry-After": "60" };

  constructor(
    provider: string,
    message = "Rate limit exceeded",
    options?: ErrorOptions,
  ) {
    super(`[${provider}] ${message}`, options);
  }

  override get publicMessage() {
    return "The game platform is rate limiting us. Try again in a minute.";
  }
}

export class ProviderUnavailableError extends AppError {
  readonly status = 502;
  readonly code = "PROVIDER_UNAVAILABLE";

  constructor(provider: string, message: string, options?: ErrorOptions) {
    super(`[${provider}] ${message}`, options);
  }

  override get publicMessage() {
    return "The game platform is temporarily unavailable. Try again later.";
  }
}

/** The failures a platform API can report. */
export type ProviderError =
  | ProviderAuthError
  | ProviderRateLimitError
  | ProviderUnavailableError;

/**
 * How a provider method that returns an outcome (`ok` / `empty` / `error`)
 * reports a failure: never by throwing, always with the reason, so the caller
 * can tell "rate limited, back off" from "this one game failed".
 */
export type ProviderFailure = { status: "error"; error: ProviderError };

const isProviderError = (err: unknown): err is ProviderError =>
  err instanceof ProviderAuthError ||
  err instanceof ProviderRateLimitError ||
  err instanceof ProviderUnavailableError;

/**
 * Turns anything that went wrong into a {@link ProviderFailure}. A typed
 * provider error passes through unchanged (a 429 stays a rate limit); anything
 * else (network failure, unreadable payload, plain message) becomes
 * {@link ProviderUnavailableError}, keeping the original as its `cause`.
 */
export function failed(
  provider: string,
  err: unknown,
  message?: string,
): ProviderFailure {
  if (isProviderError(err)) return { status: "error", error: err };
  const detail =
    message ?? (err instanceof Error ? err.message : String(err ?? "Request failed"));
  return {
    status: "error",
    error: new ProviderUnavailableError(provider, detail, {
      cause: err instanceof Error ? err : undefined,
    }),
  };
}
