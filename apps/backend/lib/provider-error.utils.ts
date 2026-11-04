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
