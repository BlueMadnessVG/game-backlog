import * as v from "valibot";

/**
 * Every environment variable the backend reads is declared here, with its
 * type, default and rules. Nothing else touches `process.env`.
 *
 * The variables are grouped into sections so each part of the app checks only
 * what it uses: a script that signs a token needs `JWT_SECRET`, not the Steam
 * key. The server checks ALL sections at startup with {@link loadConfig}, so
 * a bad deploy reports every missing or malformed variable at once instead of
 * failing on whichever module happens to load first.
 *
 * Values are secrets, so an error names the variable and the rule it broke,
 * never what was supplied.
 */

/** A variable that must be set. An empty string counts as unset. */
const required = (name: string) =>
  v.pipe(v.string(`${name} is required`), v.minLength(1, `${name} is required`));

const server = v.pipe(
  v.object({
    // Not defaulted: only an explicit "development" shows error details, and
    // only an explicit "production" blocks the setup scripts. Unset is
    // neither, which is what the code has always done.
    APP_ENV: v.optional(
      v.picklist(
        ["development", "test", "production"],
        'APP_ENV must be "development", "test" or "production"',
      ),
    ),
    PORT: v.pipe(
      v.optional(v.string(), "3000"),
      v.transform(Number),
      v.integer("PORT must be a whole number"),
      v.minValue(1, "PORT must be between 1 and 65535"),
      v.maxValue(65535, "PORT must be between 1 and 65535"),
    ),
    FRONTEND_URL: v.pipe(
      v.optional(v.string(), "http://localhost:5173"),
      v.url("FRONTEND_URL must be a valid URL"),
    ),
    // Only the exact word "true" turns scope enforcement on.
    ENFORCE_API_TOKEN_SCOPES: v.pipe(
      v.optional(v.string(), "false"),
      v.transform((value) => value === "true"),
    ),
  }),
  v.transform((env) => ({
    appEnv: env.APP_ENV,
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,
    enforceApiTokenScopes: env.ENFORCE_API_TOKEN_SCOPES,
  })),
);

const database = v.pipe(
  v.object({
    DATABASE_URL: v.pipe(
      required("DATABASE_URL"),
      v.regex(
        /^postgres(ql)?:\/\//,
        "DATABASE_URL must start with postgres:// or postgresql://",
      ),
    ),
  }),
  v.transform((env) => ({ databaseUrl: env.DATABASE_URL })),
);

const jwt = v.pipe(
  v.object({
    JWT_SECRET: v.pipe(
      required("JWT_SECRET"),
      v.minLength(
        32,
        "JWT_SECRET must be at least 32 characters (generate one with `openssl rand -hex 32`)",
      ),
    ),
  }),
  v.transform((env) => ({ jwtSecret: env.JWT_SECRET })),
);

const encryption = v.pipe(
  v.object({
    ENCRYPTION_KEY: v.pipe(
      required("ENCRYPTION_KEY"),
      v.regex(
        /^[0-9a-fA-F]{64}$/,
        "ENCRYPTION_KEY must be 64 hex characters, i.e. 32 bytes (generate one with `openssl rand -hex 32`)",
      ),
    ),
  }),
  v.transform((env) => ({ encryptionKey: env.ENCRYPTION_KEY })),
);

const providers = v.pipe(
  v.object({
    STEAM_API_KEY: required("STEAM_API_KEY"),
    OPENXBL_API_KEY: required("OPENXBL_API_KEY"),
    IGDB_CLIENT_ID: required("IGDB_CLIENT_ID"),
    IGDB_CLIENT_SECRET: required("IGDB_CLIENT_SECRET"),
    GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
    GOOGLE_REDIRECT_URI: required("GOOGLE_REDIRECT_URI"),
    DISCORD_CLIENT_ID: required("DISCORD_CLIENT_ID"),
    DISCORD_CLIENT_SECRET: required("DISCORD_CLIENT_SECRET"),
    DISCORD_REDIRECT_URI: required("DISCORD_REDIRECT_URI"),
  }),
  v.transform((env) => ({
    steamApiKey: env.STEAM_API_KEY,
    openxblApiKey: env.OPENXBL_API_KEY,
    igdbClientId: env.IGDB_CLIENT_ID,
    igdbClientSecret: env.IGDB_CLIENT_SECRET,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI,
    discordClientId: env.DISCORD_CLIENT_ID,
    discordClientSecret: env.DISCORD_CLIENT_SECRET,
    discordRedirectUri: env.DISCORD_REDIRECT_URI,
  })),
);

// Developer-only (script/seed-user.ts); every value is optional.
const seed = v.pipe(
  v.object({
    SEED_USER_EMAIL: v.optional(v.string()),
    SEED_USER_USERNAME: v.optional(v.string()),
    SEED_USER_PASSWORD: v.optional(v.string()),
  }),
  v.transform((env) => ({
    email: env.SEED_USER_EMAIL,
    username: env.SEED_USER_USERNAME,
    password: env.SEED_USER_PASSWORD,
  })),
);

const sections = { server, database, jwt, encryption, providers, seed };

type Sections = typeof sections;
export type SectionName = keyof Sections;
export type Config = { [K in SectionName]: v.InferOutput<Sections[K]> };

const namesOf = (section: Sections[SectionName]): string[] =>
  Object.keys(section.pipe[0].entries);

/** Every variable name the config reads (kept in step with `.env.example` by a test). */
export const envVariableNames: readonly string[] = Object.values(sections).flatMap(namesOf);

type Env = Record<string, string | undefined>;

/** Thrown when the environment is not a valid configuration. */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}\n` +
        "See apps/backend/.env.example for every variable the server reads.",
    );
    this.name = "ConfigError";
  }
}

/**
 * The section's own variables, and only those. An empty string is the same as
 * not set. Every name is present even when unset (as `undefined`): the schema
 * then reports it with its own message ("STEAM_API_KEY is required") instead of
 * valibot's generic "Invalid key".
 */
const inputFor = (name: SectionName, env: Env): Env =>
  Object.fromEntries(
    namesOf(sections[name]).map((variable) => [
      variable,
      env[variable] === "" ? undefined : env[variable],
    ]),
  );

function parseSection<K extends SectionName>(
  name: K,
  env: Env,
): { output: v.InferOutput<Sections[K]> } | { problems: string[] } {
  // abortPipeEarly: one problem per variable (its first broken rule).
  const result = v.safeParse(sections[name] as v.GenericSchema, inputFor(name, env), {
    abortPipeEarly: true,
  });
  if (result.success) return { output: result.output as v.InferOutput<Sections[K]> };
  return { problems: result.issues.map((issue) => issue.message) };
}

/**
 * One section of the configuration, validated now. Not cached: it is cheap,
 * and it lets a flag such as `ENFORCE_API_TOKEN_SCOPES` follow the environment
 * the way the code that read `process.env` directly always did.
 *
 * @throws {ConfigError} Naming every invalid variable in the section.
 */
export function readConfig<K extends SectionName>(
  section: K,
  env: Env = process.env,
): v.InferOutput<Sections[K]> {
  const parsed = parseSection(section, env);
  if ("problems" in parsed) throw new ConfigError(parsed.problems);
  return parsed.output;
}

/**
 * The whole configuration. The server calls this first thing at startup, so a
 * misconfigured deploy fails once, with every problem listed.
 *
 * @throws {ConfigError} Naming every invalid variable in every section.
 */
export function loadConfig(env: Env = process.env): Config {
  const problems: string[] = [];
  const config: Record<string, unknown> = {};

  for (const name of Object.keys(sections) as SectionName[]) {
    const parsed = parseSection(name, env);
    if ("problems" in parsed) problems.push(...parsed.problems);
    else config[name] = parsed.output;
  }

  if (problems.length > 0) throw new ConfigError(problems);
  return config as Config;
}
