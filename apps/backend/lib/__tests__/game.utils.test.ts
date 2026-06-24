import { describe, it, expect } from "vitest";
import { deriveGameStatus } from "../game.utils";

const NOW = new Date();
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("deriveGameStatus", () => {
  describe("completed", () => {
    it("return completed when completionPercentage is 100 with achievements", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 100,
          hasAchievements: true,
          playTimeMinutes: 500,
          lastPlayedAt: daysAgo(400),
        }),
      ).toBe("completed");
    });

    it("return completed when completionPercentage is 100 regardless of last played date", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 100,
          hasAchievements: true,
          playTimeMinutes: 0,
          lastPlayedAt: null,
        }),
      ).toBe("completed");
    });

    it("return completed when no achievements and playtime >= 10 hours", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: false,
          playTimeMinutes: 600,
          lastPlayedAt: daysAgo(400),
        }),
      ).toBe("completed");
    });

    it("returns completed when no achievements and playtime > 10 hours", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: false,
          playTimeMinutes: 1200,
          lastPlayedAt: null,
        }),
      ).toBe("completed");
    });

    it("does NOT return completed when has achievements but percentage < 100", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 99,
          hasAchievements: true,
          playTimeMinutes: 1200,
          lastPlayedAt: null,
        }),
      ).not.toBe("completed");
    });

    it("does NOT return completed when no achievements and playtime < 10 hours", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: false,
          playTimeMinutes: 599,
          lastPlayedAt: null,
        }),
      ).not.toBe("completed");
    });
  });

  // ── Backlog ───────────────────────────────────────────────────────────────
  describe("backlog", () => {
    it("returns backlog when never played (null lastPlayedAt)", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 0,
          lastPlayedAt: null,
        }),
      ).toBe("backlog");
    });

    it("returns backlog when played between 30 and 365 days ago", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 60,
          lastPlayedAt: daysAgo(180),
        }),
      ).toBe("backlog");
    });

    it("returns backlog when played exactly 31 days ago", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 60,
          lastPlayedAt: daysAgo(31),
        }),
      ).toBe("backlog");
    });
  });

  describe("platinumEarned override (PlayStation)", () => {
    it("returns completed when platinumEarned is true regardless of percentage", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 80,
          hasAchievements: true,
          playTimeMinutes: 200,
          lastPlayedAt: daysAgo(400), // would be retired otherwise
          platinumEarned: true,
        }),
      ).toBe("completed");
    });

    it("returns completed when platinumEarned is true and never played", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 0,
          lastPlayedAt: null,
          platinumEarned: true,
        }),
      ).toBe("completed");
    });

    it("does NOT short-circuit when platinumEarned is false", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 0,
          lastPlayedAt: null,
          platinumEarned: false,
        }),
      ).toBe("backlog");
    });

    it("does NOT short-circuit when platinumEarned is undefined (non-PS game)", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 50,
          hasAchievements: true,
          playTimeMinutes: 200,
          lastPlayedAt: daysAgo(400),
          // platinumEarned not passed
        }),
      ).toBe("retired");
    });
  });

  // ── In-progress ───────────────────────────────────────────────────────────
  describe("in-progress", () => {
    it("returns in-progress when played within last 30 days", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 50,
          hasAchievements: true,
          playTimeMinutes: 120,
          lastPlayedAt: daysAgo(10),
        }),
      ).toBe("in-progress");
    });

    it("returns in-progress when played today", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 30,
          lastPlayedAt: daysAgo(0),
        }),
      ).toBe("in-progress");
    });

    it("returns in-progress when played exactly 30 days ago", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 60,
          lastPlayedAt: daysAgo(30),
        }),
      ).toBe("in-progress");
    });
  });

  // ── Retired ───────────────────────────────────────────────────────────────
  describe("retired", () => {
    it("returns retired when last played more than 1 year ago", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 50,
          hasAchievements: true,
          playTimeMinutes: 200,
          lastPlayedAt: daysAgo(400),
        }),
      ).toBe("retired");
    });

    it("returns retired when last played exactly 365 days ago", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 60,
          lastPlayedAt: daysAgo(365),
        }),
      ).toBe("retired");
    });

    it("does NOT return retired when completed even if very old", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 100,
          hasAchievements: true,
          playTimeMinutes: 500,
          lastPlayedAt: daysAgo(1000),
        }),
      ).toBe("completed");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("handles completionPercentage of 0 with no playtime and no lastPlayedAt", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: true,
          playTimeMinutes: 0,
          lastPlayedAt: null,
        }),
      ).toBe("backlog");
    });

    it("handles completionPercentage above 100 (data anomaly) as completed", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 101,
          hasAchievements: true,
          playTimeMinutes: 0,
          lastPlayedAt: null,
        }),
      ).toBe("completed");
    });

    it("no achievements + 0 playtime + never played = backlog", () => {
      expect(
        deriveGameStatus({
          completionPercentage: 0,
          hasAchievements: false,
          playTimeMinutes: 0,
          lastPlayedAt: null,
        }),
      ).toBe("backlog");
    });
  });
});
