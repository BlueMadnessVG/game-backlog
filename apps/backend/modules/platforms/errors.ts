import { AppError } from "../../lib/errors";

/**
 * The game isn't in the user's library, on this platform. Covers a game that
 * doesn't exist, one that exists in the catalog but isn't theirs, one on a
 * different platform than the route, and a user with no account linked: to the
 * caller they're the same thing.
 */
export class GameNotFoundError extends AppError {
  readonly status = 404;
  readonly code = "GAME_NOT_FOUND";

  constructor(gameId: string) {
    super(`Game not found: ${gameId}`);
  }
}

/** The user hasn't linked an account on this platform yet. */
export class AccountNotLinkedError extends AppError {
  readonly status = 409;
  readonly code = "ACCOUNT_NOT_LINKED";

  constructor(platform: string) {
    super(`No ${platform} account linked — sync required`);
  }
}

/**
 * Linking failed because of what the USER supplied: an id the platform
 * doesn't know, or a credential it rejected. 422, not 401: the user's session
 * is fine, and a 401 would make the frontend log them out.
 */
export class LinkFailedError extends AppError {
  readonly status = 422;
  readonly code = "LINK_FAILED";
}

/**
 * The platform no longer accepts the stored credentials (PSN revoked the
 * refresh token), so the user has to link the account again. 409, never 401,
 * for the same reason as {@link LinkFailedError}.
 */
export class RelinkRequiredError extends AppError {
  readonly status = 409;
  readonly code = "RELINK_REQUIRED";

  constructor(platform: string, options?: ErrorOptions) {
    super(`Your ${platform} connection has expired — link it again`, options);
  }
}
