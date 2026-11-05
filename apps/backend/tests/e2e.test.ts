import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

import { createApp } from "../app";
import { createTestDb, type TestDb } from "./test-db";
import { seedOwnedGame, seedUser } from "./seed";
import type { AdvisoryLockClient } from "../lib/locks";
import {
  ProviderRateLimitError,
  ProviderUnavailableError,
} from "../lib/provider-error.utils";

// Bun's argon2 is not what this proves (and tests run under node).
vi.mock("../lib/password.utils", () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
  verifyPassword: vi.fn(async (p: string, h: string) => h === `hash:${p}`),
}));

const noopLock: AdvisoryLockClient = {
  tryAcquire: async () => true,
  release: async () => undefined,
};

const STEAM_ID = "76561198012345678";

const unavailable = () => ({
  status: "error",
  error: new ProviderUnavailableError("SteamProvider", "down"),
});

/**
 * The real app (app.ts, the same factory index.ts uses) with real services on
 * a real database. Only what lives outside the process is faked: the Steam
 * API, IGDB and the OAuth providers.
 */
describe("API end to end (real app, real database)", () => {
  let t: TestDb;
  let steam: {
    getPlayerSummary: ReturnType<typeof vi.fn>;
    getOwnedGames: ReturnType<typeof vi.fn>;
    getPlayerAchievements: ReturnType<typeof vi.fn>;
    getGameSchema: ReturnType<typeof vi.fn>;
  };
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await t.reset();
    steam = {
      getPlayerSummary: vi.fn().mockResolvedValue({
        steamId: STEAM_ID,
        displayName: "GabeN",
        avatar: "https://avatar",
        profileUrl: "https://steamcommunity.com/id/gaben",
      }),
      getOwnedGames: vi.fn().mockResolvedValue([
        { steamAppId: "570", name: "Dota 2", playtimeMinutes: 120, iconUrl: null, coverUrl: null, lastPlayedAt: null },
        { steamAppId: "620", name: "Portal 2", playtimeMinutes: 60, iconUrl: null, coverUrl: null, lastPlayedAt: null },
      ]),
      // Achievement lookups fail, which leaves the games visible in the library.
      getPlayerAchievements: vi.fn().mockResolvedValue(unavailable()),
      getGameSchema: vi.fn().mockResolvedValue(unavailable()),
    };
    app = createApp({
      db: t.db,
      lock: noopLock,
      providers: {
        steam: steam as never,
        xbox: {} as never,
        psn: {} as never,
        igdb: {} as never,
        google: {} as never,
        discord: {} as never,
      },
    });
  });

  const json = (res: Response) => res.json() as Promise<any>;

  /** Registers through the API and returns the session cookie it set. */
  const register = async (username: string, email: string) => {
    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password: "supersecret123" }),
    });
    expect(res.status).toBe(201);
    const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    return { cookie, userId: (await json(res)).data.user.id as string };
  };

  // A cookie-authenticated write needs the CSRF header, as the browser sends.
  const asSession = (cookie: string, init: RequestInit = {}) => ({
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Request-With": "frontend",
      ...(init.headers as Record<string, string>),
      Cookie: cookie,
    },
  });
  const asToken = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

  it("register → link Steam and sync → mint a token → read with it → revoke → refused", async () => {
    const alice = await register("alice", "alice@example.com");
    // Someone else's library must never show up in Alice's results.
    const bob = await seedUser(t.db, "bob");
    await seedOwnedGame(t.db, bob, { title: "Bob's Secret Game", platform: "steam" });

    // Link Steam and sync the library.
    const sync = await app.request(
      "/api/v1/steam/sync",
      asSession(alice.cookie, { method: "POST", body: JSON.stringify({ steamId: STEAM_ID }) }),
    );
    expect(sync.status).toBe(200);
    expect((await json(sync)).data.gamesCount).toBe(2);
    // The sync keeps working on achievements after responding; let it finish.
    await vi.waitFor(() => expect(steam.getGameSchema).toHaveBeenCalledTimes(2));

    // Mint an API token (a human session may; the response carries the secret once).
    const minted = await app.request(
      "/api/v1/auth/api-tokens",
      asSession(alice.cookie, { method: "POST", body: JSON.stringify({ name: "assistant" }) }),
    );
    expect(minted.status).toBe(201);
    const { id: tokenId, token } = (await json(minted)).data;
    expect(token).toMatch(/^bkl_/);

    // Read the library with the token: Alice's two games, nothing of Bob's.
    const library = await app.request("/api/v1/library/games", asToken(token));
    expect(library.status).toBe(200);
    const body = await json(library);
    expect(body.meta.total).toBe(2);
    expect(body.data.map((g: any) => g.title).sort()).toEqual(["Dota 2", "Portal 2"]);

    // A machine credential cannot mint more credentials.
    const reMint = await app.request("/api/v1/auth/api-tokens", {
      method: "POST",
      headers: { ...asToken(token).headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "child" }),
    });
    expect(reMint.status).toBe(403);

    // Revoke it as the human.
    const revoke = await app.request(
      `/api/v1/auth/api-tokens/${tokenId}`,
      asSession(alice.cookie, { method: "DELETE" }),
    );
    expect(revoke.status).toBe(200);

    // The very next request with the token is refused, as JSON in the API's one error shape.
    const after = await app.request("/api/v1/library/games", asToken(token));
    expect(after.status).toBe(401);
    expect(await json(after)).toMatchObject({ status: "ERROR", code: expect.any(String) });
  });

  it("tells the caller when a platform fails, instead of reporting a sync of zero", async () => {
    const alice = await register("alice", "alice@example.com");
    await app.request(
      "/api/v1/steam/sync",
      asSession(alice.cookie, { method: "POST", body: JSON.stringify({ steamId: STEAM_ID }) }),
    );
    await vi.waitFor(() => expect(steam.getGameSchema).toHaveBeenCalledTimes(2));
    const list = await app.request("/api/v1/library/games", asSession(alice.cookie));
    const gameId = (await json(list)).data[0].id as string;
    steam.getGameSchema.mockResolvedValue({
      status: "error",
      error: new ProviderRateLimitError("SteamProvider"),
    });

    const res = await app.request(
      `/api/v1/steam/games/${gameId}/sync-achievements`,
      asSession(alice.cookie, { method: "POST" }),
    );

    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await json(res)).toMatchObject({
      status: "ERROR",
      code: "PROVIDER_RATE_LIMITED",
    });
  });

  it("keeps one user's token from reading or revoking another user's data", async () => {
    const alice = await register("alice", "alice@example.com");
    const mallory = await register("mallory", "mallory@example.com");
    const minted = await app.request(
      "/api/v1/auth/api-tokens",
      asSession(alice.cookie, { method: "POST", body: JSON.stringify({ name: "alice-token" }) }),
    );
    const { id: aliceTokenId, token } = (await json(minted)).data;

    // Mallory cannot revoke Alice's token (404, indistinguishable from "no such token")…
    const attempt = await app.request(
      `/api/v1/auth/api-tokens/${aliceTokenId}`,
      asSession(mallory.cookie, { method: "DELETE" }),
    );
    expect(attempt.status).toBe(404);
    // …Alice's token still works…
    expect((await app.request("/api/v1/library/games", asToken(token))).status).toBe(200);
    // …and Mallory cannot see it in her list.
    const list = await app.request("/api/v1/auth/api-tokens", asSession(mallory.cookie));
    expect((await json(list)).data).toEqual([]);
  });

  it("answers unauthenticated and unknown requests in the API's error shape", async () => {
    const anon = await app.request("/api/v1/library/games");
    expect(anon.status).toBe(401);
    expect(await json(anon)).toMatchObject({ status: "ERROR", code: "MISSING_COORDINATES" });

    const missing = await app.request("/api/v1/nope");
    expect(missing.status).toBe(404);
    expect(await json(missing)).toMatchObject({ status: "ERROR", code: "ROUTE_NOT_FOUND" });
  });
});
