/**
 * Issues ONE opaque `bkl_...` API token from the command line, for a
 * machine client that can't log in through the browser (e.g. the
 * achievement-ai assistant, a CI job posting to a sync endpoint).
 *
 * Authorization model: scripts can't present an HTTP session, so this
 * requires an ADMIN ACTOR — `--admin <email>` must resolve to a user whose
 * `users.role` is "admin" (checked inline against the DB; this is the one
 * place that role read belongs, since require-admin.middleware.ts has no
 * production HTTP caller). The token is issued to `--user <email>`
 * (defaults to the admin's own email). A leaked token is then still
 * powerless to mint more — API tokens may only read, and POST /api-tokens
 * requires a real session credential (see
 * require-session-credential.middleware.ts).
 *
 * The mint runs as ONE transaction inside createApiToken (auth.services.ts):
 * the token row and its audit event (api_token_events) commit or roll back
 * together, so an issued token can never lack an audit record.
 *
 * Usage:
 *   bun run db:token --admin admin@example.com --user who@example.com --name ci
 *   bun run db:token --admin admin@example.com --scope write:library --days 90
 *
 * Flags:
 *   --admin <email>  Required. Operator whose users.role must be "admin".
 *   --user <email>   Recipient. Defaults to the admin email.
 *   --name <label>   Token label (default "cli").
 *   --scope <scope>  read:library (default) or write:library.
 *   --days <n>       Expiry in days (default 30). 0 = never expires.
 *
 * WARNING: prints the live plaintext token to stdout and never persists it
 * anywhere but its hash. Run this on the machine whose DATABASE_URL you
 * mean, and never against production.
 */
import { eq } from "drizzle-orm";
import { parse } from "valibot";

import { ApiTokenScopeSchema, type OAuthProvider } from "@repo/shared";

import { closeDb, db } from "../db";
import { users } from "../db/schema";
import { AuthService } from "../modules/auth/auth.services";
import type { OAuthProviderClient } from "../providers/oauth.types";
import { assertNotProduction } from "./env-guard";

const DEFAULT_DAYS = 30;

interface CliArgs {
  adminEmail: string;
  userEmail: string;
  name: string;
  scope: string;
  days: number;
}

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
        "Usage: bun run db:token [options]",
        "",
        "  --admin <email>  Required. Operator whose users.role must be 'admin'.",
        "  --user <email>   Recipient of the token (default: the admin email).",
        "  --name <label>   Token label (default: cli).",
        "  --scope <scope>  read:library (default) or write:library.",
        "  --days <n>       Expiry in days (default 30). 0 = never expires.",
      ].join("\n"),
    );
    process.exit(0);
  }

  const adminEmail = flags.get("admin")?.[0];
  if (!adminEmail) {
    throw new Error(
      "Missing --admin <email>. Minting API tokens requires an admin actor.",
    );
  }

  const userEmail = flags.get("user")?.[0] ?? adminEmail;

  const scope = parse(
    ApiTokenScopeSchema,
    flags.get("scope")?.[0] ?? "read:library",
  );

  const daysRaw = flags.get("days")?.[0];
  const days = daysRaw === undefined ? DEFAULT_DAYS : Number(daysRaw);
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(`Invalid --days value: ${daysRaw}`);
  }

  return {
    adminEmail,
    userEmail,
    name: flags.get("name")?.[0] ?? "cli",
    scope,
    days,
  };
}

async function main(): Promise<void> {
  assertNotProduction();

  const args = parseArgs(Bun.argv.slice(2));

  // Empty provider map keeps the script from needing Google/Discord creds —
  // register()/createApiToken() never consult it (same trick as seed-user.ts).
  const auth = new AuthService(
    db,
    {} as Record<OAuthProvider, OAuthProviderClient>,
  );

  // Inline admin check — reads users.role directly, like seed-user.ts, since
  // require-admin.middleware.ts has no production HTTP caller to reuse.
  const [admin] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, args.adminEmail))
    .limit(1);
  if (!admin) {
    throw new Error(`Admin user not found: ${args.adminEmail}`);
  }
  if (admin.role !== "admin") {
    throw new Error(
      `Minting API tokens requires an admin actor; ${args.adminEmail} has role "${admin.role}".`,
    );
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, args.userEmail))
    .limit(1);
  if (!target) {
    throw new Error(`Target user not found: ${args.userEmail}`);
  }

  const expiresAt =
    args.days > 0
      ? new Date(Date.now() + args.days * 24 * 60 * 60 * 1000)
      : undefined;

  // One transaction: token row + audit event commit together.
  const issued = await auth.createApiToken(target.id, {
    name: args.name,
    scope: args.scope,
    expiresAt,
    // Script-originated, not an HTTP request — record it honestly rather
    // than fabricating an IP.
    audit: {
      triggeredBy: "session",
      ip: "localhost",
      userAgent: "create-api-token.ts",
    },
  });

  console.log(
    `\n🔑 MINTED API TOKEN for ${args.userEmail} [${args.name} / ${args.scope}]`,
  );
  console.log(`   id      ${issued.id}`);
  console.log(`   token   ${issued.token}`);
  console.log(`   prefix  ${issued.tokenPrefix}`);
  console.log(`   expires ${expiresAt?.toISOString() ?? "never"}`);
  console.log("\n   The plaintext appears exactly once — store it securely now.");
}

main()
  .then(closeDb)
  .catch(async (error: unknown) => {
    console.error("❌ Failed to mint API token:", error);
    await closeDb().catch(() => {});
    process.exit(1);
  });