import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

import { steamAccounts, users } from "../../../db/schema";
import { createTestDb, type TestDb } from "../../../tests/test-db";
import { seedUser } from "../../../tests/seed";
import { SteamAdapter } from "../steam.adapter";

const profile = (steamId = "76561198012345678") => ({
  steamId,
  displayName: "GabeN",
  avatar: "https://avatar",
  profileUrl: "https://steamcommunity.com/id/gaben",
});

const makeProvider = () => ({
  getPlayerSummary: vi.fn(),
  getOwnedGames: vi.fn(),
  getPlayerAchievements: vi.fn(),
  getGameSchema: vi.fn(),
});

const player = (apiName: string, achieved: boolean, extra = {}) => ({
  apiName,
  achieved,
  unlockedAt: achieved ? new Date("2026-03-01T00:00:00Z") : null,
  name: `player ${apiName}`,
  description: null,
  ...extra,
});

const meta = (overrides = {}) => ({
  displayName: "Display",
  description: "About it",
  hidden: true,
  iconUrl: "https://icon",
  iconGrayUrl: "https://icon-gray",
  globalPercentage: 12.5,
  ...overrides,
});

describe("SteamAdapter", () => {
  let provider: ReturnType<typeof makeProvider>;
  let adapter: SteamAdapter;

  beforeEach(() => {
    provider = makeProvider();
    adapter = new SteamAdapter(provider as never);
  });

  it("describes Steam's rate limits and that it needs no cover enrichment", () => {
    expect(adapter.platform).toBe("steam");
    expect(adapter.batch).toEqual({ size: 5, delayMs: 200 });
    expect(adapter.enrichCovers).toBe(false);
  });

  it("validates the link body as a 17-character Steam id", async () => {
    const { safeParse } = await import("valibot");

    expect(safeParse(adapter.linkSchema, { steamId: "76561198012345678" }).success).toBe(true);
    expect(safeParse(adapter.linkSchema, { steamId: "123" }).success).toBe(false);
    expect(safeParse(adapter.linkSchema, {}).success).toBe(false);
  });

  describe("link and loadAccount (real database)", () => {
    let t: TestDb;
    beforeAll(async () => {
      t = await createTestDb();
    });
    afterAll(() => t.close());
    beforeEach(() => t.reset());

    it("stores the account, takes the Steam name as the username, and returns the profile", async () => {
      const alice = await seedUser(t.db, "alice");
      await t.db.delete(steamAccounts); // seedUser links one; start unlinked
      provider.getPlayerSummary.mockResolvedValue(profile());

      const result = await adapter.link(t.db, alice, { steamId: "76561198012345678" });

      expect(result).toEqual(profile());
      const [account] = await t.db.select().from(steamAccounts);
      expect(account).toMatchObject({ userId: alice, steamId: "76561198012345678" });
      expect(account!.lastSync).toBeInstanceOf(Date);
      const [user] = await t.db.select().from(users).where(eq(users.id, alice));
      expect(user!.username).toBe("GabeN");
    });

    it("relinking with a different Steam id replaces the stored one", async () => {
      const alice = await seedUser(t.db, "alice");
      provider.getPlayerSummary.mockResolvedValueOnce(profile("76561198000000001"));
      await adapter.link(t.db, alice, { steamId: "76561198000000001" });

      provider.getPlayerSummary.mockResolvedValueOnce(profile("76561198000000002"));
      await adapter.link(t.db, alice, { steamId: "76561198000000002" });

      const accounts = await t.db.select().from(steamAccounts).where(eq(steamAccounts.userId, alice));
      expect(accounts.map((a) => a.steamId)).toEqual(["76561198000000002"]);
    });

    it("fails, and stores nothing, when Steam doesn't know the profile", async () => {
      const alice = await seedUser(t.db, "alice");
      await t.db.delete(steamAccounts);
      provider.getPlayerSummary.mockResolvedValue(null);

      await expect(adapter.link(t.db, alice, { steamId: "76561198012345678" })).rejects.toThrow(
        /Could not find Steam profile/,
      );
      expect(await t.db.select().from(steamAccounts)).toHaveLength(0);
    });

    it("loads the linked account, or null when there is none", async () => {
      const alice = await seedUser(t.db, "alice");
      const [linked] = await t.db.select().from(steamAccounts);

      expect(await adapter.loadAccount(t.db, alice)).toEqual({ steamId: linked!.steamId });
      expect(await adapter.loadAccount(t.db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    });
  });

  describe("fetchOwnedGames", () => {
    it("maps Steam's library entries to owned games", async () => {
      const lastPlayedAt = new Date("2026-02-01T00:00:00Z");
      provider.getOwnedGames.mockResolvedValue([
        { steamAppId: "570", name: "Dota 2", playtimeMinutes: 1234, iconUrl: "https://i", coverUrl: "https://c", lastPlayedAt },
      ]);

      const result = await adapter.fetchOwnedGames({ steamId: "76561198012345678" });

      expect(provider.getOwnedGames).toHaveBeenCalledWith("76561198012345678");
      expect(result).toEqual([
        {
          externalId: "570",
          title: "Dota 2",
          iconUrl: "https://i",
          coverUrl: "https://c",
          bannerUrl: "https://cdn.akamai.steamstatic.com/steam/apps/570/library_hero.jpg",
          playTimeMinutes: 1234,
          lastPlayedAt,
          // Steam reports completion through achievements, not the library.
          completionPercentage: null,
        },
      ]);
    });
  });

  describe("fetchAchievements", () => {
    const account = { steamId: "76561198012345678" };
    const game = { externalId: "570" };

    it("merges the player's state with the game's definitions", async () => {
      provider.getPlayerAchievements.mockResolvedValue([player("ACH_1", true), player("ACH_2", false)]);
      provider.getGameSchema.mockResolvedValue({
        status: "ok",
        schema: new Map([["ACH_1", meta()], ["ACH_2", meta({ displayName: "Second", hidden: false, globalPercentage: null })]]),
      });

      const outcome = await adapter.fetchAchievements(account, game);

      expect(provider.getPlayerAchievements).toHaveBeenCalledWith("76561198012345678", "570");
      expect(provider.getGameSchema).toHaveBeenCalledWith("570");
      expect(outcome).toEqual({
        status: "ok",
        achievements: [
          {
            externalKey: "ACH_1", name: "Display", description: "About it", hidden: true,
            iconUrl: "https://icon", iconGrayUrl: "https://icon-gray", globalPercentage: 12.5,
            points: null, tier: null, achieved: true, unlockedAt: new Date("2026-03-01T00:00:00Z"),
          },
          {
            externalKey: "ACH_2", name: "Second", description: "About it", hidden: false,
            iconUrl: "https://icon", iconGrayUrl: "https://icon-gray", globalPercentage: null,
            points: null, tier: null, achieved: false, unlockedAt: null,
          },
        ],
      });
    });

    it("falls back to the player's own data for an achievement missing from the definitions", async () => {
      provider.getPlayerAchievements.mockResolvedValue([player("ACH_X", true, { description: "from player" })]);
      provider.getGameSchema.mockResolvedValue({ status: "ok", schema: new Map([["OTHER", meta()]]) });

      const outcome = await adapter.fetchAchievements(account, game);

      expect(outcome).toMatchObject({
        status: "ok",
        achievements: [
          { externalKey: "ACH_X", name: "player ACH_X", description: "from player", hidden: false, iconUrl: null, globalPercentage: null },
        ],
      });
    });

    it("reports 'empty' when Steam says the game defines no achievements", async () => {
      provider.getPlayerAchievements.mockResolvedValue(null);
      provider.getGameSchema.mockResolvedValue({ status: "empty" });

      expect(await adapter.fetchAchievements(account, game)).toEqual({ status: "empty" });
    });

    it("reports 'error' when the definitions lookup failed", async () => {
      provider.getPlayerAchievements.mockResolvedValue([player("ACH_1", true)]);
      provider.getGameSchema.mockResolvedValue({ status: "error" });

      expect(await adapter.fetchAchievements(account, game)).toEqual({ status: "error" });
    });

    it("reports 'error', not 'empty', when the game has definitions but the player's side is unavailable", async () => {
      // e.g. a private profile: we know nothing about this player's progress.
      provider.getPlayerAchievements.mockResolvedValue(null);
      provider.getGameSchema.mockResolvedValue({ status: "ok", schema: new Map([["ACH_1", meta()]]) });

      expect(await adapter.fetchAchievements(account, game)).toEqual({ status: "error" });
    });
  });
});
