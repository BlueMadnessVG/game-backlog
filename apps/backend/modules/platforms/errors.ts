/**
 * The game isn't in the user's library, on this platform. Covers a game that
 * doesn't exist, one that exists in the catalog but isn't theirs, one on a
 * different platform than the route, and a user with no account linked: to the
 * caller they're the same thing. Maps to 404.
 */
export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`Game not found: ${gameId}`);
    this.name = "GameNotFoundError";
  }
}
