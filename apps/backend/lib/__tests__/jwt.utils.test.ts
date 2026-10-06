import { describe, it, expect } from "vitest";

import {
  signAuthToken,
  verifyAuthToken,
  TokenPurposeMismatchError,
} from "../jwt.utils";

describe("jwt.utils", () => {
  it("signs and verifies a token round-trip", async () => {
    const token = await signAuthToken({
      sub: "user-1",
      email: "user@example.com",
      provider: "google",
    });

    const payload = await verifyAuthToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
    expect(payload.provider).toBe("google");
  });

  it("rejects a tampered token", async () => {
    const token = await signAuthToken({
      sub: "user-1",
      email: "user@example.com",
      provider: "google",
    });

    const tampered = `${token.slice(0, -2)}zz`;

    await expect(verifyAuthToken(tampered)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await signAuthToken(
      {
        sub: "user-1",
        email: "user@example.com",
        provider: "discord",
      },
      new Date(Date.now() - 60_000),
    );

    await expect(verifyAuthToken(token)).rejects.toThrow();
  });

  it("rejects a step-up token by default", async () => {
    const token = await signAuthToken({
      sub: "user-1",
      email: "user@example.com",
      provider: "step_up",
      purpose: "step_up",
    });

    await expect(verifyAuthToken(token)).rejects.toBeInstanceOf(
      TokenPurposeMismatchError,
    );
  });

  it("accepts a step-up token when allowPurpose opts in", async () => {
    const token = await signAuthToken({
      sub: "user-1",
      email: "user@example.com",
      provider: "step_up",
      purpose: "step_up",
    });

    const payload = await verifyAuthToken(token, {
      allowPurpose: ["session", "step_up"],
    });

    expect(payload.purpose).toBe("step_up");
    expect(payload.provider).toBe("step_up");
  });
});
