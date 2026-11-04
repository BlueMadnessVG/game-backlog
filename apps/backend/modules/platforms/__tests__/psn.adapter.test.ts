import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { safeParse } from "valibot";

import { psnAccounts, users } from "../../../db/schema";
import type { AdvisoryLockClient } from "../../../lib/locks";
import { decrypt, encrypt } from "../../../lib/Encryption.utils";
import { createTestDb, type TestDb } from "../../../tests/test-db";
import { seedUser } from "../../../tests/seed";
import { PsnAdapter } from "../psn.adapter";
import { LinkFailedError, RelinkRequiredError } from "../errors";
import {
  ProviderAuthError,
  ProviderUnavailableError,
} from "../../../lib/provider-error.utils";

// seedUser links a PSN account whose tokens are encrypted "seed-access-token" /
// "seed-refresh-token" and valid for an hour.

const noopLock: AdvisoryLockClient = {
  tryAcquire: async () => true,
  release: async () => undefined,
};

const makeProvider = () => ({
  exchangeNpsso: vi.fn(),
  getProfile: vi.fn(),
  refreshTokens: vi.fn(),
  getOwnedGames: vi.fn(),
  getGameTrophies: vi.fn(),
});

const tokens = (overrides = {}) => ({
  accessToken: "new-access-token",
  refreshToken: "new-refresh-token",
  accessTokenExpiresAt: Date.now() + 3_600_000,
  ...overrides,
});

const profile = () => ({
  accountId: "1234567890123456789",
  onlineId: "BlueMadness9897",
  avatarUrl: "https://avatar",
});

const title = (overrides = {}) => ({
  npCommunicationId: "NPWR20188_00",
  name: "Astro's Playroom",
  iconUrl: "https://icon",
  trophyTitlePlatform: "PS5",
  npServiceName: "trophy2" as const,
  completionPercentage: 75,
  platinumEarned: false,
  lastUpdatedDateTime: "2026-06-01T00:00:00Z",
  ...overrides,
});

const trophy = (trophyId: string, overrides = {}) => ({
  trophyId,
  name: `Trophy ${trophyId}`,
  detail: "How to get it",
  trophyType: "bronze" as const,
  trophyHidden: false,
  trophyIconUrl: "https://trophy-icon",
  trophyEarnedRate: 45.3,
  earned: true,
  earnedDateTime: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

describe("PsnAdapter", () => {
  let provider: ReturnType<typeof makeProvider>;
  let adapter: PsnAdapter;

  beforeEach(() => {
    provider = makeProvider();
    adapter = new PsnAdapter(provider as never, noopLock);
  });

  it("describes PSN's rate limits and that its covers come from IGDB", () => {
    expect(adapter.platform).toBe("playstation");
    expect(adapter.batch).toEqual({ size: 5, delayMs: 500 });
    expect(adapter.enrichCovers).toBe(true);
  });

  it("validates the link body: an NPSSO of at most 64 characters and an online id", () => {
    expect(safeParse(adapter.linkSchema, { npsso: "x".repeat(64), onlineId: "Blue" }).success).toBe(true);
    expect(safeParse(adapter.linkSchema, { npsso: "x".repeat(65), onlineId: "Blue" }).success).toBe(false);
    expect(safeParse(adapter.linkSchema, { npsso: "", onlineId: "Blue" }).success).toBe(false);
    expect(safeParse(adapter.linkSchema, { onlineId: "Blue" }).success).toBe(false);
  });

  describe("with a real database", () => {
    let t: TestDb;
    beforeAll(async () => {
      t = await createTestDb();
    });
    afterAll(() => t.close());
    beforeEach(() => t.reset());

    const accountOf = async (userId: string) =>
      (await t.db.select().from(psnAccounts).where(eq(psnAccounts.userId, userId)))[0]!;

    /** Replaces the stored tokens, as if time had passed. */
    const setStoredTokens = (
      userId: string,
      { expiresInMs, access = "stored-access", refresh = "stored-refresh" }: { expiresInMs: number; access?: string; refresh?: string },
    ) =>
      t.db
        .update(psnAccounts)
        .set({
          accessToken: encrypt(access),
          refreshToken: encrypt(refresh),
          accessTokenExpiresAt: new Date(Date.now() + expiresInMs),
        })
        .where(eq(psnAccounts.userId, userId));

    describe("link", () => {
      beforeEach(() => {
        provider.exchangeNpsso.mockResolvedValue(tokens());
        provider.getProfile.mockResolvedValue(profile());
      });

      it("exchanges the NPSSO, looks the profile up with the new access token, and stores the account", async () => {
        const alice = await seedUser(t.db, "alice");
        await t.db.delete(psnAccounts); // start unlinked

        await adapter.link(t.db, alice, { npsso: "the-npsso", onlineId: "BlueMadness9897" });

        expect(provider.exchangeNpsso).toHaveBeenCalledWith("the-npsso");
        expect(provider.getProfile).toHaveBeenCalledWith("new-access-token", "BlueMadness9897");
        const account = await accountOf(alice);
        expect(account).toMatchObject({
          accountId: "1234567890123456789",
          onlineId: "BlueMadness9897",
          avatarUrl: "https://avatar",
        });
        expect(account.lastSync).toBeInstanceOf(Date);
        const [user] = await t.db.select().from(users).where(eq(users.id, alice));
        expect(user!.username).toBe("BlueMadness9897");
      });

      it("stores both tokens encrypted, never as plaintext", async () => {
        const alice = await seedUser(t.db, "alice");

        await adapter.link(t.db, alice, { npsso: "n", onlineId: "BlueMadness9897" });

        const account = await accountOf(alice);
        expect(account.accessToken).not.toContain("new-access-token");
        expect(account.refreshToken).not.toContain("new-refresh-token");
        expect(decrypt(account.accessToken)).toBe("new-access-token");
        expect(decrypt(account.refreshToken)).toBe("new-refresh-token");
      });

      it("returns only the account, so no token can reach the HTTP response", async () => {
        const alice = await seedUser(t.db, "alice");

        const result = await adapter.link(t.db, alice, { npsso: "n", onlineId: "BlueMadness9897" });

        expect(result).toEqual(profile());
        expect(Object.keys(result).sort()).toEqual(["accountId", "avatarUrl", "onlineId"]);
        expect(JSON.stringify(result)).not.toContain("new-");
      });

      it("a relink replaces the tokens and the account in place", async () => {
        const alice = await seedUser(t.db, "alice");
        await adapter.link(t.db, alice, { npsso: "n", onlineId: "BlueMadness9897" });

        provider.exchangeNpsso.mockResolvedValue(tokens({ accessToken: "second-access", refreshToken: "second-refresh" }));
        provider.getProfile.mockResolvedValue({ ...profile(), accountId: "999", onlineId: "Renamed" });
        await adapter.link(t.db, alice, { npsso: "n2", onlineId: "Renamed" });

        const rows = await t.db.select().from(psnAccounts).where(eq(psnAccounts.userId, alice));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ accountId: "999", onlineId: "Renamed" });
        expect(decrypt(rows[0]!.accessToken)).toBe("second-access");
        expect(decrypt(rows[0]!.refreshToken)).toBe("second-refresh");
      });

      it("stores nothing when PSN doesn't know the profile", async () => {
        const alice = await seedUser(t.db, "alice");
        await t.db.delete(psnAccounts);
        provider.getProfile.mockResolvedValue(null);

        const failure = await adapter
          .link(t.db, alice, { npsso: "n", onlineId: "Nobody" })
          .catch((e) => e);

        expect(failure).toBeInstanceOf(LinkFailedError);
        expect(failure.message).toMatch(/Could not find PSN profile for online ID: Nobody/);
        expect(await t.db.select().from(psnAccounts)).toHaveLength(0);
      });

      // The NPSSO is what the user pasted in. PSN refusing it is their input
      // (422), and must never surface as a 401, which logs them out.
      it("reports a rejected NPSSO as LinkFailedError, keeping the cause", async () => {
        const alice = await seedUser(t.db, "alice");
        await t.db.delete(psnAccounts);
        const rejected = new ProviderAuthError("PsnProvider", "NPSSO exchange failed");
        provider.exchangeNpsso.mockRejectedValue(rejected);

        const failure = await adapter
          .link(t.db, alice, { npsso: "stale", onlineId: "Blue" })
          .catch((e) => e);

        expect(failure).toBeInstanceOf(LinkFailedError);
        expect(failure).toMatchObject({ status: 422, code: "LINK_FAILED" });
        expect(failure.cause).toBe(rejected);
        expect(provider.getProfile).not.toHaveBeenCalled();
        expect(await t.db.select().from(psnAccounts)).toHaveLength(0);
      });

      it("lets a PSN outage during the NPSSO exchange through as it is (a 502, not the user's fault)", async () => {
        const alice = await seedUser(t.db, "alice");
        await t.db.delete(psnAccounts);
        const outage = new ProviderUnavailableError("PsnProvider", "HTTP 503");
        provider.exchangeNpsso.mockRejectedValue(outage);

        await expect(
          adapter.link(t.db, alice, { npsso: "n", onlineId: "Blue" }),
        ).rejects.toBe(outage);
      });

      it("stores nothing when the NPSSO exchange fails", async () => {
        const alice = await seedUser(t.db, "alice");
        await t.db.delete(psnAccounts);
        provider.exchangeNpsso.mockRejectedValue(new Error("NPSSO expired"));

        await expect(
          adapter.link(t.db, alice, { npsso: "stale", onlineId: "Blue" }),
        ).rejects.toThrow("NPSSO expired");
        expect(provider.getProfile).not.toHaveBeenCalled();
        expect(await t.db.select().from(psnAccounts)).toHaveLength(0);
      });
    });

    describe("loadAccount: keeping the access token valid", () => {
      it("returns null when the user has no account linked", async () => {
        expect(await adapter.loadAccount(t.db, "00000000-0000-0000-0000-000000000000")).toBeNull();
      });

      it("returns the decrypted stored token when it is still fresh, without refreshing", async () => {
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: 3_600_000, access: "still-good" });

        expect(await adapter.loadAccount(t.db, alice)).toEqual({ accessToken: "still-good" });
        expect(provider.refreshTokens).not.toHaveBeenCalled();
      });

      it("refreshes an expired token with the DECRYPTED refresh token and returns the new plaintext token", async () => {
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: -1000, refresh: "old-refresh-plain" });
        provider.refreshTokens.mockResolvedValue(tokens({ accessToken: "fresh-access", refreshToken: "fresh-refresh" }));

        const account = await adapter.loadAccount(t.db, alice);

        expect(provider.refreshTokens).toHaveBeenCalledWith("old-refresh-plain");
        expect(account).toEqual({ accessToken: "fresh-access" });
      });

      it("stores the refreshed tokens encrypted, with the new expiry", async () => {
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: -1000 });
        const expiresAt = Date.now() + 7_200_000;
        provider.refreshTokens.mockResolvedValue(
          tokens({ accessToken: "fresh-access", refreshToken: "fresh-refresh", accessTokenExpiresAt: expiresAt }),
        );

        await adapter.loadAccount(t.db, alice);

        const stored = await accountOf(alice);
        expect(stored.accessToken).not.toContain("fresh-access");
        expect(stored.refreshToken).not.toContain("fresh-refresh");
        expect(decrypt(stored.accessToken)).toBe("fresh-access");
        expect(decrypt(stored.refreshToken)).toBe("fresh-refresh");
        expect(stored.accessTokenExpiresAt.getTime()).toBe(expiresAt);
      });

      it("treats a token with under a minute left as expired, and one with more as fresh", async () => {
        const alice = await seedUser(t.db, "alice");
        provider.refreshTokens.mockResolvedValue(tokens({ accessToken: "refreshed" }));

        await setStoredTokens(alice, { expiresInMs: 30_000, access: "about-to-expire" });
        expect(await adapter.loadAccount(t.db, alice)).toEqual({ accessToken: "refreshed" });

        provider.refreshTokens.mockClear();
        await setStoredTokens(alice, { expiresInMs: 120_000, access: "two-minutes-left" });
        expect(await adapter.loadAccount(t.db, alice)).toEqual({ accessToken: "two-minutes-left" });
        expect(provider.refreshTokens).not.toHaveBeenCalled();
      });

      it("refreshes once when several requests find the token expired at the same time", async () => {
        // A batch of trophy syncs all ask for the token together. Refreshing
        // once per caller would invalidate the tokens the others just got.
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: -1000 });
        provider.refreshTokens.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return tokens({ accessToken: "the-one-refresh" });
        });

        const results = await Promise.all([
          adapter.loadAccount(t.db, alice),
          adapter.loadAccount(t.db, alice),
          adapter.loadAccount(t.db, alice),
        ]);

        expect(provider.refreshTokens).toHaveBeenCalledTimes(1);
        expect(results).toEqual(Array(3).fill({ accessToken: "the-one-refresh" }));
      });

      it("a caller that gets the lock after another refreshed uses the new token instead of refreshing again", async () => {
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: -1000 });
        // Simulates the other request: while waiting for the lock, the tokens
        // get refreshed by someone else.
        const racing = new PsnAdapter(provider as never, {
          tryAcquire: async () => {
            await setStoredTokens(alice, { expiresInMs: 3_600_000, access: "refreshed-by-someone-else" });
            return true;
          },
          release: async () => undefined,
        });

        expect(await racing.loadAccount(t.db, alice)).toEqual({ accessToken: "refreshed-by-someone-else" });
        expect(provider.refreshTokens).not.toHaveBeenCalled();
      });

      it("keeps the stored tokens and fails when the refresh fails", async () => {
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: -1000, access: "old-access", refresh: "old-refresh" });
        provider.refreshTokens.mockRejectedValue(new Error("refresh token revoked"));

        await expect(adapter.loadAccount(t.db, alice)).rejects.toThrow("refresh token revoked");

        const stored = await accountOf(alice);
        expect(decrypt(stored.accessToken)).toBe("old-access");
        expect(decrypt(stored.refreshToken)).toBe("old-refresh");
      });

      // PSN no longer accepts the stored refresh token: only linking again
      // helps. 409 RELINK_REQUIRED, never a 401 (which logs the user out).
      it("asks the user to relink, and keeps the stored tokens, when PSN rejects the refresh token", async () => {
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: -1000, access: "old-access", refresh: "old-refresh" });
        const rejected = new ProviderAuthError("PsnProvider", "refresh token expired");
        provider.refreshTokens.mockRejectedValue(rejected);

        const failure = await adapter.loadAccount(t.db, alice).catch((e) => e);

        expect(failure).toBeInstanceOf(RelinkRequiredError);
        expect(failure).toMatchObject({ status: 409, code: "RELINK_REQUIRED" });
        expect(failure.cause).toBe(rejected);
        const stored = await accountOf(alice);
        expect(decrypt(stored.accessToken)).toBe("old-access");
        expect(decrypt(stored.refreshToken)).toBe("old-refresh");
      });

      it("lets a PSN outage during a refresh through as it is, without asking for a relink", async () => {
        const alice = await seedUser(t.db, "alice");
        await setStoredTokens(alice, { expiresInMs: -1000 });
        const outage = new ProviderUnavailableError("PsnProvider", "HTTP 503");
        provider.refreshTokens.mockRejectedValue(outage);

        await expect(adapter.loadAccount(t.db, alice)).rejects.toBe(outage);
      });
    });
  });

  describe("fetchOwnedGames", () => {
    const account = { accessToken: "tok" };

    it("maps PSN titles to owned games, carrying the service name as metadata", async () => {
      provider.getOwnedGames.mockResolvedValue([
        title(),
        title({
          npCommunicationId: "NPWR00001_00",
          name: "Old Game",
          trophyTitlePlatform: "PS4",
          npServiceName: "trophy",
          platinumEarned: true,
          lastUpdatedDateTime: null,
        }),
      ]);

      const games = await adapter.fetchOwnedGames(account);

      expect(provider.getOwnedGames).toHaveBeenCalledWith("tok");
      expect(games).toEqual([
        {
          externalId: "NPWR20188_00",
          title: "Astro's Playroom",
          iconUrl: "https://icon",
          coverUrl: null,
          bannerUrl: null,
          playTimeMinutes: null,
          lastPlayedAt: new Date("2026-06-01T00:00:00Z"),
          completionPercentage: 75,
          platinumEarned: false,
          metadata: { npServiceName: "trophy2", trophyTitlePlatform: "PS5" },
        },
        expect.objectContaining({
          externalId: "NPWR00001_00",
          lastPlayedAt: null,
          platinumEarned: true,
          metadata: { npServiceName: "trophy", trophyTitlePlatform: "PS4" },
        }),
      ]);
    });

    it("reports no play time, so the engine never overwrites a stored one", async () => {
      provider.getOwnedGames.mockResolvedValue([title()]);

      const [game] = await adapter.fetchOwnedGames(account);

      expect(game!.playTimeMinutes).toBeNull();
    });
  });

  describe("fetchAchievements", () => {
    const account = { accessToken: "tok" };

    it("maps trophies, keeping the type as the tier so a platinum can complete the game", async () => {
      provider.getGameTrophies.mockResolvedValue({
        status: "ok",
        trophies: [
          trophy("0", { trophyType: "platinum" }),
          trophy("1", { earned: false, earnedDateTime: null, trophyHidden: true, trophyEarnedRate: null, detail: null }),
        ],
      });

      const outcome = await adapter.fetchAchievements(account, {
        externalId: "NPWR20188_00",
        metadata: { npServiceName: "trophy2" },
      });

      expect(outcome).toEqual({
        status: "ok",
        achievements: [
          {
            externalKey: "0", name: "Trophy 0", description: "How to get it", hidden: false,
            iconUrl: "https://trophy-icon", iconGrayUrl: null, globalPercentage: 45.3,
            points: null, tier: "platinum", achieved: true, unlockedAt: new Date("2026-01-01T00:00:00Z"),
          },
          expect.objectContaining({
            externalKey: "1", description: null, hidden: true, globalPercentage: null,
            tier: "bronze", achieved: false, unlockedAt: null,
          }),
        ],
      });
    });

    it.each([
      ["trophy2", { npServiceName: "trophy2" }],
      ["trophy2", {}],
      ["trophy2", null],
      ["trophy", { npServiceName: "trophy" }],
    ])("asks PSN for the '%s' service when the game's metadata is %j", async (expected, metadata) => {
      provider.getGameTrophies.mockResolvedValue({ status: "empty" });

      await adapter.fetchAchievements(account, { externalId: "NPWR1_00", metadata });

      expect(provider.getGameTrophies).toHaveBeenCalledWith("tok", "NPWR1_00", expected);
    });

    it.each([["empty"], ["error"]])("passes '%s' through unchanged", async (status) => {
      provider.getGameTrophies.mockResolvedValue({ status });

      expect(
        await adapter.fetchAchievements(account, { externalId: "x", metadata: null }),
      ).toEqual({ status });
    });
  });
});
