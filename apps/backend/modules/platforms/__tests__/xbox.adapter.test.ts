import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { safeParse } from "valibot";

import { users, xboxAccounts } from "../../../db/schema";
import { createTestDb, type TestDb } from "../../../tests/test-db";
import { seedUser } from "../../../tests/seed";
import { XboxAdapter } from "../xbox.adapter";

const profile = (xuid = "2533274968382425") => ({
  xuid,
  gamertag: "BlueMadness9897",
  avatarUrl: "https://avatar",
  gamerscore: 15763,
});

const makeProvider = () => ({
  getPlayerProfile: vi.fn(),
  getOwnedGames: vi.fn(),
  getPlaytimeMinutes: vi.fn(),
  getPlayerAchievements: vi.fn(),
});

const title = (titleId: string, overrides = {}) => ({
  titleId,
  name: `Title ${titleId}`,
  coverUrl: `https://cover/${titleId}.jpg`,
  playtimeMinutes: 0,
  lastPlayedAt: new Date("2026-02-01T00:00:00Z"),
  completionPercentage: 40,
  ...overrides,
});

const achievement = (apiName: string, overrides = {}) => ({
  apiName,
  name: `Achievement ${apiName}`,
  description: "About it",
  isSecret: false,
  iconUrl: "https://icon",
  gamerscore: 25,
  globalPercentage: 8.5,
  achieved: true,
  unlockedAt: new Date("2026-03-01T00:00:00Z"),
  ...overrides,
});

describe("XboxAdapter", () => {
  let provider: ReturnType<typeof makeProvider>;
  let adapter: XboxAdapter;

  beforeEach(() => {
    provider = makeProvider();
    adapter = new XboxAdapter(provider as never);
  });

  it("describes Xbox's rate limits and that its covers come from IGDB", () => {
    expect(adapter.platform).toBe("xbox");
    expect(adapter.batch).toEqual({ size: 5, delayMs: 500 });
    expect(adapter.enrichCovers).toBe(true);
  });

  it("validates the link body as a non-empty xuid", () => {
    expect(safeParse(adapter.linkSchema, { xuid: "2533274968382425" }).success).toBe(true);
    expect(safeParse(adapter.linkSchema, { xuid: "" }).success).toBe(false);
    expect(safeParse(adapter.linkSchema, {}).success).toBe(false);
  });

  describe("link and loadAccount (real database)", () => {
    let t: TestDb;
    beforeAll(async () => {
      t = await createTestDb();
    });
    afterAll(() => t.close());
    beforeEach(() => t.reset());

    it("stores the account, takes the gamertag as the username, and returns the profile", async () => {
      const alice = await seedUser(t.db, "alice");
      await t.db.delete(xboxAccounts); // seedUser links one; start unlinked
      provider.getPlayerProfile.mockResolvedValue(profile());

      const result = await adapter.link(t.db, alice, { xuid: "2533274968382425" });

      expect(result).toEqual(profile());
      const [account] = await t.db.select().from(xboxAccounts);
      expect(account).toMatchObject({
        userId: alice,
        xuid: "2533274968382425",
        gamertag: "BlueMadness9897",
      });
      expect(account!.lastSync).toBeInstanceOf(Date);
      const [user] = await t.db.select().from(users).where(eq(users.id, alice));
      expect(user!.username).toBe("BlueMadness9897");
    });

    it("relinking with a different xuid replaces the stored one", async () => {
      const alice = await seedUser(t.db, "alice");
      provider.getPlayerProfile.mockResolvedValueOnce(profile("1111"));
      await adapter.link(t.db, alice, { xuid: "1111" });

      provider.getPlayerProfile.mockResolvedValueOnce(profile("2222"));
      await adapter.link(t.db, alice, { xuid: "2222" });

      const accounts = await t.db.select().from(xboxAccounts).where(eq(xboxAccounts.userId, alice));
      expect(accounts.map((a) => a.xuid)).toEqual(["2222"]);
    });

    it("fails, and stores nothing, when Xbox doesn't know the profile", async () => {
      const alice = await seedUser(t.db, "alice");
      await t.db.delete(xboxAccounts);
      provider.getPlayerProfile.mockResolvedValue(null);

      await expect(adapter.link(t.db, alice, { xuid: "9999" })).rejects.toThrow(
        /Could not find Xbox profile for XUID: 9999/,
      );
      expect(await t.db.select().from(xboxAccounts)).toHaveLength(0);
    });

    it("loads the linked account, or null when there is none", async () => {
      const alice = await seedUser(t.db, "alice");
      const [linked] = await t.db.select().from(xboxAccounts);

      expect(await adapter.loadAccount(t.db, alice)).toEqual({ xuid: linked!.xuid });
      expect(await adapter.loadAccount(t.db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    });
  });

  describe("fetchOwnedGames", () => {
    const account = { xuid: "2533274968382425" };

    it("merges play time into the title history and maps to owned games", async () => {
      provider.getOwnedGames.mockResolvedValue([title("t1"), title("t2")]);
      provider.getPlaytimeMinutes.mockResolvedValue(new Map([["t1", 300]]));

      const result = await adapter.fetchOwnedGames(account);

      expect(provider.getOwnedGames).toHaveBeenCalledWith("2533274968382425");
      expect(provider.getPlaytimeMinutes).toHaveBeenCalledWith("2533274968382425", ["t1", "t2"]);
      expect(result).toEqual([
        {
          externalId: "t1",
          title: "Title t1",
          iconUrl: null,
          coverUrl: "https://cover/t1.jpg",
          bannerUrl: null,
          playTimeMinutes: 300,
          lastPlayedAt: new Date("2026-02-01T00:00:00Z"),
          completionPercentage: 40,
        },
        expect.objectContaining({ externalId: "t2" }),
      ]);
    });

    it("uses 0 play time for a title missing from the stats", async () => {
      provider.getOwnedGames.mockResolvedValue([title("t1")]);
      provider.getPlaytimeMinutes.mockResolvedValue(new Map());

      const [game] = await adapter.fetchOwnedGames(account);

      expect(game!.playTimeMinutes).toBe(0);
    });

    it("doesn't ask for play time when there are no titles", async () => {
      provider.getOwnedGames.mockResolvedValue([]);

      expect(await adapter.fetchOwnedGames(account)).toEqual([]);
      expect(provider.getPlaytimeMinutes).not.toHaveBeenCalled();
    });
  });

  describe("fetchAchievements", () => {
    const account = { xuid: "2533274968382425" };
    const game = { externalId: "t1" };

    it("maps achievements, keeping gamerscore as points and secrets as hidden", async () => {
      provider.getPlayerAchievements.mockResolvedValue({
        status: "ok",
        achievements: [achievement("1"), achievement("2", { isSecret: true, achieved: false, unlockedAt: null })],
      });

      const outcome = await adapter.fetchAchievements(account, game);

      expect(provider.getPlayerAchievements).toHaveBeenCalledWith("2533274968382425", "t1");
      expect(outcome).toEqual({
        status: "ok",
        achievements: [
          {
            externalKey: "1", name: "Achievement 1", description: "About it", hidden: false,
            iconUrl: "https://icon", iconGrayUrl: null, globalPercentage: 8.5,
            points: 25, tier: null, achieved: true, unlockedAt: new Date("2026-03-01T00:00:00Z"),
          },
          expect.objectContaining({ externalKey: "2", hidden: true, achieved: false, unlockedAt: null }),
        ],
      });
    });

    it.each([["empty"], ["error"]])("passes '%s' through unchanged", async (status) => {
      provider.getPlayerAchievements.mockResolvedValue({ status });

      expect(await adapter.fetchAchievements(account, game)).toEqual({ status });
    });
  });
});
