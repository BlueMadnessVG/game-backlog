import type { OAuthProvider } from "@repo/shared";

export interface StoredOAuthState {
  provider: OAuthProvider;
  codeVerifier: string;
  createdAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

const store = new Map<string, StoredOAuthState>();

/**
 * Single-instance, in-memory store for OAuth state + PKCE verifiers.
 *
 * Entries expire after 10 minutes and are single-use (consumed on the first
 * callback that matches). If the backend ever scales to multiple instances,
 * swap this for a DB table or a signed state cookie.
 */
export const oauthStateStore = {
  set(state: string, value: StoredOAuthState): void {
    store.set(state, value);
  },

  /**
   * Reads and removes a stored state, validating provider + expiry.
   * Returns `null` when the state is unknown, already used, mismatched, or
   * expired.
   */
  consume(state: string, provider: OAuthProvider): StoredOAuthState | null {
    const entry = store.get(state);
    if (!entry) return null;

    store.delete(state);

    if (entry.provider !== provider) return null;
    if (Date.now() - entry.createdAt > STATE_TTL_MS) return null;

    return entry;
  },

  size(): number {
    return store.size;
  },
};
