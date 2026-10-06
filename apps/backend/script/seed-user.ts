/**
 * Creates (or repairs) users and issues the full credential bundle other apps
 * need: password login, a ready-to-use session JWT, and opaque `bkl_...` API
 * tokens for machine/third-party clients. Optionally promotes a user to admin.
 *
 * Idempotent by design — safe to re-run:
 *   - the user is upserted by email (an existing OAuth-only account gets a
 *     password attached rather than a duplicate-email crash);
 *   - tokens are rotated: same-name live tokens are soft-revoked before a
 *     fresh one is issued, so re-runs never accumulate dead rows;
 *   - the role is only touched when explicitly passed, so re-running never
 *     silently demotes an admin you promoted earlier.
 *
 * The ONLY supported way to create an admin. No HTTP endpoint can promote a
 * user — `register()` and the OAuth upsert both leave `users.role` at its
 * column default — so privilege escalation requires direct script or DB
 * access on purpose.
 *
 * Usage:
 *   bun run script/seed-user.ts
 *   bun run script/seed-user.ts --admin
 *   bun run script/seed-user.ts --manifest ./script/seed.manifest.example.json
 *   bun run script/seed-user.ts --email ci@example.com --token github-actions
 *
 * WARNING: plaintext passwords and live `bkl_...` tokens are printed to stdout
 * and written to .seed/credentials.json. Never run this against production.
 */
import { and, eq, isNull } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "valibot";

import { RegisterSchema, UserRoleSchema, type OAuthProvider } from "@repo/shared";

import { closeDb, db } from "../db";
import { apiTokens, users } from "../db/schema";
import { signAuthToken } from "../lib/jwt.utils";
import { hashPassword } from "../lib/password.utils";
import { AuthService } from "../modules/auth/auth.services";
import type { OAuthProviderClient } from "../providers/oauth.types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_USER = {
  username: "test_user",
  email: "test@example.com",
  // Dev-only fallback so a fresh clone seeds with zero configuration. The env
  // var wins, and CI should always set it explicitly.
  password: "Test1234!do-not-use-in-prod",
};

const DEFAULT_TOKENS = [
  { name: "seed-frontend", scope: "read:library", expiresInDays: 30 },
  { name: "seed-achievement-ai", scope: "read:library", expiresInDays: 90 },
];

/** Session JWT lifetime for seeded users — matches jwt.utils' own default. */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const OUT_FILE = resolve(import.meta.dir, "../.seed/credentials.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenSpec {
  name: string;
  scope: string;
  expiresInDays?: number;
}

interface UserSpec {
  username: string;
  email: string;
  password: string;
  /**
   * Optional on purpose. `undefined` means "leave the existing role alone",
   * which is what keeps a plain re-run from demoting an admin. Only "admin"
   * is meaningful here; an explicit "user" would demote, so it must be asked
   * for deliberately rather than defaulted.
   */
  role?: string;
  tokens?: TokenSpec[];
}

interface SeededApiToken {
  id: string;
  name: string;
  token: string;
  tokenPrefix: string;
  scope: string;
  expiresAt: string | null;
}

interface SeededUser {
  id: string;
  username: string;
  email: string;
  role: string;
  created: boolean;
  password: string;
  sessionJwt: string;
  sessionJwtExpiresAt: string;
  apiTokens: SeededApiToken[];
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  manifest?: string;
  out: string;
  users: UserSpec[];
}

/**
 * Minimal `--flag value` / `--flag` parser. A flag with no following
 * non-`--` token is treated as boolean (bare `--admin`).
 */
function parseArgs(argv: string[]): CliArgs {
  const flags = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags.set(key, []);
    } else {
      flags.set(key, [next]);
      i++;
    }
  }

  if (flags.has("help")) {
    console.log(
      [
        "Usage: bun run db:seed [options]",
        "",
        "  --manifest <file>   JSON file describing users, roles and tokens",
        "  --email <email>     Email for a single ad-hoc user",
        "  --username <name>   Username (default: email local-part, sanitized)",
        "  --password <pw>     Password (default: $SEED_USER_PASSWORD)",
        "  --token <name>      Issue an API token; repeatable. name[:scope[:days]]",
        "  --admin             Promote this user to the admin role",
        "  --out <file>        Output path (default: .seed/credentials.json)",
        "",
        "Without --admin the existing role is left untouched, so re-running the",
        "seed never silently demotes an admin you promoted earlier.",
      ].join("\n"),
    );
    process.exit(0);
  }

  const manifestPath = flags.get("manifest")?.[0];
  if (manifestPath) return { manifest: manifestPath, out: OUT_FILE, users: [] };

  const password =
    flags.get("password")?.[0] ??
    process.env.SEED_USER_PASSWORD ??
    DEFAULT_USER.password;

  const email =
    flags.get("email")?.[0] ?? process.env.SEED_USER_EMAIL ?? DEFAULT_USER.email;

  const username =
    flags.get("username")?.[0] ??
    process.env.SEED_USER_USERNAME ??
    // Sanitized to satisfy AuthUsernameSchema's regex/limits so an ad-hoc
    // --email still produces a valid username instead of failing validation.
    email.split("@")[0]!.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24);

  // `--token ci` -> defaults; `--token ci:write:library:30` -> explicit.
  const tokens: TokenSpec[] = (flags.get("token") ?? []).map((raw) => {
    const [name = "seed", scope = "read:library", days] = raw.split(":");
    return { name, scope, expiresInDays: days ? Number(days) : undefined };
  });

  return {
    out: flags.get("out")?.[0] ?? OUT_FILE,
    users: [
      {
        username,
        email,
        password,
        // Only set when explicitly asked — an absent key means "don't touch it".
        ...(flags.has("admin") ? { role: "admin" } : {}),
        tokens: tokens.length > 0 ? tokens : DEFAULT_TOKENS,
      },
    ],
  };
}

async function loadManifest(path: string): Promise<UserSpec[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Manifest not found: ${path}`);

  const parsed = (await file.json()) as { users?: unknown };
  if (!Array.isArray(parsed.users)) {
    throw new Error(`Manifest must contain a "users" array: ${path}`);
  }
  return parsed.users as UserSpec[];
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * `register()` deliberately rejects duplicate emails, so seeding needs its own
 * upsert: insert when absent, and when present just (re)attach a password —
 * which also repairs an OAuth-only account that could never log in with one.
 *
 * Note we validate credentials through RegisterSchema but read `role` from the
 * raw spec, because valibot's object output strips unknown keys — including
 * role, which is intentionally not part of RegisterSchema.
 */
async function upsertUser(
  auth: AuthService,
  spec: UserSpec,
): Promise<Omit<SeededUser, "password" | "sessionJwt" | "sessionJwtExpiresAt" | "apiTokens">> {
  const { username, email, password } = parse(RegisterSchema, spec);
  const passwordHash = await hashPassword(password);

  // Validated up front so a typo fails with a readable message instead of a
  // Postgres 22P02 invalid-enum-value error from deep inside the driver.
  const role = spec.role === undefined ? undefined : parse(UserRoleSchema, spec.role);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const current = existing[0];

  if (current) {
    const [updated] = await db
      .update(users)
      .set({ username, passwordHash, ...(role ? { role } : {}) })
      .where(eq(users.id, current.id))
      .returning();

    if (!updated) throw new Error(`Failed to update user ${email}`);

    return {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      role: updated.role,
      created: false,
    };
  }

  const session = await auth.register({ username, email, password });

  // register() leaves role at the column default, so only an explicit
  // --admin / manifest role needs applying to a brand-new row.
  if (role) {
    await db.update(users).set({ role }).where(eq(users.id, session.user.id));
  }

  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return {
    ...session.user,
    role: role ?? row?.role ?? "user",
    created: session.created,
  };
}

/**
 * Rotates a named token: soft-revokes any live one so repeated seeding does
 * not accumulate unusable rows, then issues a fresh secret. The plaintext is
 * returned here and nowhere else — only its hash is persisted.
 */
async function rotateApiToken(
  auth: AuthService,
  userId: string,
  spec: TokenSpec,
): Promise<SeededApiToken> {
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.userId, userId),
        eq(apiTokens.name, spec.name),
        isNull(apiTokens.revokedAt),
      ),
    );

  const expiresAt = spec.expiresInDays
    ? new Date(Date.now() + spec.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const issued = await auth.createApiToken(userId, {
    name: spec.name,
    scope: spec.scope,
    expiresAt,
  });

  return {
    ...issued,
    name: spec.name,
    scope: spec.scope,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function report(results: SeededUser[]): void {
  console.log("\n🔑 SEEDED CREDENTIALS — treat as secrets, never commit\n");

  for (const u of results) {
    console.log(`  ${u.created ? "created" : "updated"}  ${u.email}`);
    console.log(`    user id    ${u.id}`);
    console.log(`    username   ${u.username}`);
    console.log(`    role       ${u.role}`);
    console.log(`    password   ${u.password}`);
    console.log(`    session    ${u.sessionJwt}`);
    console.log(`    (expires   ${u.sessionJwtExpiresAt})`);
    for (const t of u.apiTokens) {
      console.log(`    token      ${t.token}   [${t.name} / ${t.scope}]`);
    }
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(Bun.argv.slice(2));
  const specs = args.manifest ? await loadManifest(args.manifest) : args.users;

  if (specs.length === 0) {
    console.error("Nothing to seed. Pass --email, --manifest, or run with defaults.");
    process.exitCode = 1;
    return;
  }

  // Providers are unused by register()/createApiToken(); an empty map keeps the
  // script from requiring Google/Discord credentials just to seed a user.
  const auth = new AuthService(
    db,
    {} as Record<OAuthProvider, OAuthProviderClient>,
  );

  const results: SeededUser[] = [];

  for (const spec of specs) {
    const user = await upsertUser(auth, spec);

    // A ready-to-use session JWT so the frontend / an API client can skip the
    // login round-trip entirely during development.
    const sessionJwt = await signAuthToken({
      sub: user.id,
      email: user.email,
      provider: "email",
    });

    const apiTokens: SeededApiToken[] = [];
    for (const token of spec.tokens ?? []) {
      apiTokens.push(await rotateApiToken(auth, user.id, token));
    }

    results.push({
      ...user,
      password: spec.password,
      sessionJwt,
      sessionJwtExpiresAt: new Date(
        Date.now() + SESSION_TTL_SECONDS * 1000,
      ).toISOString(),
      apiTokens,
    });
  }

  await mkdir(dirname(args.out), { recursive: true });
  // mode 0600 — the file holds plaintext passwords and live API tokens.
  await writeFile(
    args.out,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), users: results }, null, 2)}\n`,
    { mode: 0o600 },
  );

  report(results);
  console.log(`  written to ${args.out}\n`);
}

main()
  .then(closeDb)
  .catch(async (error: unknown) => {
    console.error("❌ Seed failed:", error);
    await closeDb().catch(() => {});
    process.exit(1);
  });