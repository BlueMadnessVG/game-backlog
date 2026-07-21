export class ProviderAuthError extends Error {
  constructor(
    provider: string,
    message = "Invalid or expired credentials",
    options?: ErrorOptions,
  ) {
    super(`[${provider}] ${message}`, options);
    this.name = "ProviderAuthError";
  }
}

export class ProviderRateLimitError extends Error {
  constructor(
    provider: string,
    message = "Rate limit exceeded",
    options?: ErrorOptions,
  ) {
    super(`[${provider}] ${message}`, options);
    this.name = "ProviderRateLimitError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string, message: string, options?: ErrorOptions) {
    super(`[${provider}] ${message}`, options);
    this.name = "ProviderUnavailableError";
  }
}
