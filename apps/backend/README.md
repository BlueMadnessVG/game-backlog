# backend

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Structure

- `index.ts` reads the environment, builds the real external clients and starts the server.
- `app.ts` (`createApp`) is the composition root: services, middleware and routes. Tests build the same app with fakes for the outside world.

## Testing

```bash
bun run test
```

What a test fakes depends on what it proves:

| Code under test | Database | Why |
|---|---|---|
| Services, adapters, anything that queries | **Real**: in-process Postgres via `tests/test-db.ts` (PGlite replaying the real migrations) | A mocked `where()` ignores its argument, so it can't prove a query filters by user, status or revocation. |
| Controllers and middleware | Services faked, or the real DB when the middleware itself queries (`require-admin`) | They test HTTP mapping: status, body shape, who may call. |
| Providers (Steam, Xbox, PSN, IGDB) | None | They are HTTP clients; the HTTP calls are faked. |
| Whole API (`tests/e2e.test.ts`) | **Real** | Only the external services are faked, so it proves the pieces fit together. |

Helpers: `tests/test-db.ts` (`createTestDb`, one per file, `reset()` between tests), `tests/seed.ts` (scenario builders), `tests/auth.helpers.ts` (session headers and `withErrorHandling` for controllers mounted on their own).

Advisory locks (`lib/locks.ts`) only contend across separate database sessions, and PGlite has exactly one, so `lib/__tests__/locks.postgres.test.ts` runs against a real Postgres server instead: `tests/real-postgres.ts` starts a throwaway one (the `embedded-postgres` package, binaries included, no Docker) on a free port and removes it afterwards. It adds about 8 seconds, mostly `initdb`. `lib/__tests__/locks.test.ts` keeps the fast fake-client tests of the waiting and coalescing logic.

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
