/**
 * Test-only typing: `await res.json()` is `any`.
 *
 * `app.request(...)` returns a global `Response`, and with @types/node loaded
 * its `json()` is `Promise<unknown>`. The controller tests read the body as a
 * loose object (`body.data.id`), so they need `any`.
 *
 * This used to live inside one controller test file (as a `declare global`).
 * Because it is global, every other test silently depended on that file being
 * there, and deleting it broke the typecheck of unrelated tests. It is kept
 * here, in one place, on purpose.
 *
 * It is a plain script file (no import/export) so the interface merges into
 * the global scope.
 */
interface Response {
  json(): Promise<any>;
}
