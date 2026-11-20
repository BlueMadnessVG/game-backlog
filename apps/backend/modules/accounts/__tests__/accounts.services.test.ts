import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

import { psnAccounts, steamAccounts, users } from "../../../db/schema";
import { createTestDb, type TestDb } from "../../../tests/test-db";
import { seedUser } from "../../../tests/seed";
import { AccountsService } from "../accounts.services";

describe("AccountsService (real database)", () => {
  let t: TestDb;
  let service: AccountsService;

  beforeAll(async () => {
    t = await createTestDb();
    service = new AccountsService(t.db);
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  describe("getLinked", () => {
    it("returns null for every platform when nothing is linked", async () => {
      const [user] = await t.db
        .insert(users)
        .values({ username: "bob", email: "bob@example.com" })
        .returning({ id: users.id });

      expect(await service.getLinked(user!.id)).toEqual({
        steam: null,
        xbox: null,
        psn: null,
      });
    });

    it("returns each linked account, with ISO lastSync, and never the PSN tokens", async () => {
      const alice = await seedUser(t.db, "alice");
      const synced = new Date("2026-01-02T03:04:05.000Z");
      await t.db
        .update(steamAccounts)
        .set({ lastSync: synced })
        .where(eq(steamAccounts.userId, alice));

      const linked = await service.getLinked(alice);

      expect(linked.steam).toEqual({
        steamId: expect.stringMatching(/^steam-/),
        lastSync: "2026-01-02T03:04:05.000Z",
      });
      expect(linked.xbox).toEqual({
        xuid: expect.stringMatching(/^xuid-/),
        gamertag: null,
        lastSync: null,
      });
      expect(linked.psn).toEqual({
        accountId: expect.stringMatching(/^psn-/),
        onlineId: null,
        avatarUrl: null,
        lastSync: null,
      });
      expect(JSON.stringify(linked)).not.toMatch(/token/i);
    });

    it("only returns the requesting user's accounts", async () => {
      await seedUser(t.db, "alice");
      const [bob] = await t.db
        .insert(users)
        .values({ username: "bob", email: "bob2@example.com" })
        .returning({ id: users.id });

      expect(await service.getLinked(bob!.id)).toEqual({ steam: null, xbox: null, psn: null });
    });
  });

  describe("unlink", () => {
    it("removes only that platform's account for that user", async () => {
      const alice = await seedUser(t.db, "alice");
      const carol = await seedUser(t.db, "carol");

      expect(await service.unlink(alice, "psn")).toBe(true);

      const linked = await service.getLinked(alice);
      expect(linked.psn).toBeNull();
      expect(linked.steam).not.toBeNull();
      expect(linked.xbox).not.toBeNull();

      const carolPsn = await t.db
        .select()
        .from(psnAccounts)
        .where(eq(psnAccounts.userId, carol));
      expect(carolPsn).toHaveLength(1);
    });

    it("returns false when the platform isn't linked", async () => {
      const alice = await seedUser(t.db, "alice");
      await service.unlink(alice, "steam");

      expect(await service.unlink(alice, "steam")).toBe(false);
    });
  });
});
