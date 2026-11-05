import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Case-insensitive match on an email column.
 *
 * `users` is unique on `lower(email)` (see db/schema/core.ts), so this is the
 * comparison that uses that index. It also finds an account stored before
 * emails were normalised, which a plain `eq(users.email, email)` would miss.
 */
export const emailEquals = (column: AnyPgColumn, email: string): SQL =>
  sql`lower(${column}) = lower(${email})`;
