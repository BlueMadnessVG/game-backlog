import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ConfigError, envVariableNames, loadConfig, readConfig } from "./config";

const valid = {
  JWT_SECRET: "j".repeat(32),
  ENCRYPTION_KEY: "ab".repeat(32),
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  STEAM_API_KEY: "steam-key",
  OPENXBL_API_KEY: "xbl-key",
  IGDB_CLIENT_ID: "igdb-id",
  IGDB_CLIENT_SECRET: "igdb-secret",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GOOGLE_REDIRECT_URI: "http://localhost:3000/api/v1/auth/google/callback",
  DISCORD_CLIENT_ID: "discord-id",
  DISCORD_CLIENT_SECRET: "discord-secret",
  DISCORD_REDIRECT_URI: "http://localhost:3000/api/v1/auth/discord/callback",
};

const failure = (fn: () => unknown): ConfigError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return error as ConfigError;
  }
  throw new Error("expected a ConfigError, but nothing was thrown");
};

describe("loadConfig", () => {
  it("returns every section, typed, with defaults for what is optional", () => {
    const config = loadConfig(valid);

    expect(config.server).toEqual({
      appEnv: undefined,
      port: 3000,
      frontendUrl: "http://localhost:5173",
      enforceApiTokenScopes: false,
    });
    expect(config.database.databaseUrl).toBe(valid.DATABASE_URL);
    expect(config.jwt.jwtSecret).toBe(valid.JWT_SECRET);
    expect(config.encryption.encryptionKey).toBe(valid.ENCRYPTION_KEY);
    expect(config.providers).toMatchObject({
      steamApiKey: "steam-key",
      openxblApiKey: "xbl-key",
      igdbClientId: "igdb-id",
      googleRedirectUri: valid.GOOGLE_REDIRECT_URI,
      discordClientSecret: "discord-secret",
    });
    expect(config.seed).toEqual({
      email: undefined,
      username: undefined,
      password: undefined,
    });
  });

  it("reports every problem across the whole app in one error", () => {
    const { JWT_SECRET, STEAM_API_KEY, DATABASE_URL, ...rest } = valid;

    const error = failure(() => loadConfig({ ...rest, PORT: "not-a-port" }));

    // One readable line per variable, in the variable's own words.
    expect(error.problems).toEqual(
      expect.arrayContaining([
        "JWT_SECRET is required",
        "STEAM_API_KEY is required",
        "DATABASE_URL is required",
        "PORT must be a whole number",
      ]),
    );
    expect(error.problems).toHaveLength(4);
    // The message lists them too, so the startup log shows everything at once.
    for (const name of ["JWT_SECRET", "STEAM_API_KEY", "DATABASE_URL", "PORT"]) {
      expect(error.message).toContain(name);
    }
  });

  it("never puts a supplied value in the error, since these are secrets", () => {
    const error = failure(() =>
      loadConfig({
        ...valid,
        JWT_SECRET: "super-secret-but-too-short",
        ENCRYPTION_KEY: "zz-secret-not-hex",
        DATABASE_URL: "mysql://user:hunter2@host/db",
        FRONTEND_URL: "not a url with a secret",
      }),
    );

    for (const secret of ["super-secret", "zz-secret", "hunter2", "with a secret"]) {
      expect(error.message).not.toContain(secret);
    }
    expect(error.problems).toHaveLength(4);
  });

  it("treats a variable set to an empty string as unset", () => {
    expect(failure(() => loadConfig({ ...valid, STEAM_API_KEY: "" })).problems).toEqual([
      "STEAM_API_KEY is required",
    ]);
    expect(loadConfig({ ...valid, PORT: "" }).server.port).toBe(3000);
  });
});

describe("readConfig", () => {
  it("validates only its own section, so unrelated missing variables don't matter", () => {
    // A script that only signs tokens must not need the Steam key.
    expect(readConfig("jwt", { JWT_SECRET: valid.JWT_SECRET }).jwtSecret).toBe(
      valid.JWT_SECRET,
    );
    expect(readConfig("database", { DATABASE_URL: valid.DATABASE_URL }).databaseUrl).toBe(
      valid.DATABASE_URL,
    );
  });

  it("reads process.env by default, at call time", () => {
    const original = process.env.ENFORCE_API_TOKEN_SCOPES;
    try {
      process.env.ENFORCE_API_TOKEN_SCOPES = "true";
      expect(readConfig("server").enforceApiTokenScopes).toBe(true);
      delete process.env.ENFORCE_API_TOKEN_SCOPES;
      expect(readConfig("server").enforceApiTokenScopes).toBe(false);
    } finally {
      if (original !== undefined) process.env.ENFORCE_API_TOKEN_SCOPES = original;
    }
  });

  describe("rules", () => {
    it.each([
      ["a short JWT_SECRET", "jwt", { JWT_SECRET: "short" }, "JWT_SECRET"],
      ["a missing JWT_SECRET", "jwt", {}, "JWT_SECRET"],
      ["a non-hex ENCRYPTION_KEY", "encryption", { ENCRYPTION_KEY: "g".repeat(64) }, "ENCRYPTION_KEY"],
      ["a wrong-length ENCRYPTION_KEY", "encryption", { ENCRYPTION_KEY: "ab".repeat(16) }, "ENCRYPTION_KEY"],
      ["a non-postgres DATABASE_URL", "database", { DATABASE_URL: "mysql://localhost/db" }, "DATABASE_URL"],
      ["an unknown APP_ENV", "server", { APP_ENV: "prod" }, "APP_ENV"],
      ["a non-numeric PORT", "server", { PORT: "abc" }, "PORT"],
      ["a PORT out of range", "server", { PORT: "70000" }, "PORT"],
      ["a fractional PORT", "server", { PORT: "30.5" }, "PORT"],
      ["a non-URL FRONTEND_URL", "server", { FRONTEND_URL: "localhost" }, "FRONTEND_URL"],
    ] as const)("rejects %s", (_name, section, env, variable) => {
      const error = failure(() => readConfig(section, env));

      expect(error.problems.join("\n")).toContain(variable);
    });

    it.each([
      ["development", "development"],
      ["test", "test"],
      ["production", "production"],
    ] as const)("accepts APP_ENV=%s", (value, expected) => {
      expect(readConfig("server", { APP_ENV: value }).appEnv).toBe(expected);
    });

    it("leaves APP_ENV undefined when unset (an unset environment is not 'development')", () => {
      expect(readConfig("server", {}).appEnv).toBeUndefined();
    });

    it("reads PORT as a number", () => {
      expect(readConfig("server", { PORT: "8080" }).port).toBe(8080);
    });

    it.each([
      ["true", true],
      ["false", false],
      ["1", false],
      ["TRUE", false],
      ["", false],
    ])("reads ENFORCE_API_TOKEN_SCOPES=%j as %s (only the exact word 'true' turns it on)", (value, expected) => {
      expect(
        readConfig("server", { ENFORCE_API_TOKEN_SCOPES: value }).enforceApiTokenScopes,
      ).toBe(expected);
    });

    it("passes the optional seed values through", () => {
      expect(
        readConfig("seed", {
          SEED_USER_EMAIL: "a@b.co",
          SEED_USER_USERNAME: "ann",
          SEED_USER_PASSWORD: "pw",
        }),
      ).toEqual({ email: "a@b.co", username: "ann", password: "pw" });
    });
  });
});

describe(".env.example", () => {
  const text = readFileSync(path.join(import.meta.dirname, ".env.example"), "utf8");
  const example = Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1]!, m[2]!]),
  );

  it("lists exactly the variables the config reads, so it can't drift", () => {
    expect(Object.keys(example).sort()).toEqual([...envVariableNames].sort());
  });

  it("is itself a valid configuration, so copying it gives a server that starts", () => {
    expect(() => loadConfig(example)).not.toThrow();
  });
});
