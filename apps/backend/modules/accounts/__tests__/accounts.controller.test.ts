import { describe, it, expect, vi, beforeEach } from "vitest";

import { createAccountsController } from "../accounts.controller";
import { withAuth, TEST_USER_ID } from "../../../tests/auth.helpers";

const LINKED = {
  steam: { steamId: "76561198012345678", lastSync: "2026-01-02T03:04:05.000Z" },
  xbox: null,
  psn: { accountId: "psn-1", onlineId: "Blue", avatarUrl: null, lastSync: null },
};

const makeService = () => ({
  getLinked: vi.fn(async (_userId: string) => LINKED),
  unlink: vi.fn(async (_userId: string, _platform: string) => true),
});

const authService = { verifyApiToken: vi.fn() } as never;

describe("createAccountsController", () => {
  let service: ReturnType<typeof makeService>;
  let app: Awaited<ReturnType<typeof build>>;

  const build = () => withAuth(createAccountsController(service as never, authService));

  beforeEach(async () => {
    service = makeService();
    app = await build();
  });

  it("requires authentication", async () => {
    const anonymous = createAccountsController(service as never, authService);

    expect((await anonymous.request("/")).status).toBe(401);
    expect(service.getLinked).not.toHaveBeenCalled();
  });

  describe("GET /", () => {
    it("returns the user's linked accounts", async () => {
      const res = await app.request("/");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "SUCCESS", data: LINKED });
      expect(service.getLinked).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  describe("DELETE /:platform", () => {
    it("unlinks the platform", async () => {
      const res = await app.request("/psn", { method: "DELETE" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "SUCCESS", message: "Account unlinked" });
      expect(service.unlink).toHaveBeenCalledWith(TEST_USER_ID, "psn");
    });

    it("404s with ACCOUNT_NOT_LINKED when nothing was linked", async () => {
      service.unlink.mockResolvedValueOnce(false);

      const res = await app.request("/xbox", { method: "DELETE" });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body).toMatchObject({ status: "ERROR", code: "ACCOUNT_NOT_LINKED" });
    });

    it("400s on an unknown platform", async () => {
      const res = await app.request("/playstation", { method: "DELETE" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toMatchObject({ status: "ERROR", code: "VALIDATION_FAILED" });
      expect(service.unlink).not.toHaveBeenCalled();
    });
  });
});
