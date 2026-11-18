import { ApiErrorBodySchema, type ApiErrorIssue } from '@repo/shared';
import * as v from 'valibot';

import { env } from '@/env';

// ── Transport ─────────────────────────────────────────────────────────────────

/**
 * The session is an HttpOnly cookie owned by the browser, so the client only
 * has to send it (`credentials: 'include'`) and, because cookie-authenticated
 * mutating requests are CSRF-checked, the `X-Request-With` header.
 */
export const API_ORIGIN = env.VITE_API_URL.replace(/\/$/, '');

/** Origin from env plus the API prefix; also used for full-page OAuth redirects. */
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

/**
 * Client-side deadline. Slightly above the backend's own 10s `timeout()` so a
 * slow request normally fails with the server's 504 envelope, and this only
 * fires when the server never answers at all.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

const DEFAULT_HEADERS: Readonly<Record<string, string>> = {
  Accept: 'application/json',
  'X-Request-With': 'frontend',
};

const isDev = env.VITE_APP_ENV === 'development';

/**
 * Seam to the session owner: the client reports a 401, whoever holds the
 * session decides what to do. Keeps this module free of store imports.
 */
let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null): void => {
  onUnauthorized = handler;
};

// ── Errors ────────────────────────────────────────────────────────────────────

interface ApiErrorOptions {
  status?: number | null;
  issues?: ApiErrorIssue[];
  requestId?: string;
  /** Seconds to wait before retrying, from the `Retry-After` header (503s). */
  retryAfter?: number;
  cause?: unknown;
}

/**
 * The one error the client throws. `code` is stable and safe to branch on:
 * the backend's own code (e.g. `GAME_NOT_FOUND`) when it sent one, otherwise
 * `NETWORK_ERROR`, `TIMEOUT`, `INVALID_RESPONSE` or `HTTP_<status>`.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly issues: ApiErrorIssue[];
  readonly requestId: string | undefined;
  readonly retryAfter: number | undefined;

  constructor(code: string, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = options.status ?? null;
    this.issues = options.issues ?? [];
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
  }
}

/** Codes whose `message` is ours, not the server's, and not meant for users. */
export const CLIENT_ERROR_CODES = ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE'] as const;

// ── Envelope ──────────────────────────────────────────────────────────────────

/** Success envelope for endpoints that return `{ status, data }`. */
export const envelope = <S extends v.GenericSchema>(data: S) =>
  v.object({ status: v.literal('SUCCESS'), data });

/** Success envelope for endpoints that return `{ status, message, data }`. */
export const messageEnvelope = <S extends v.GenericSchema>(data: S) =>
  v.object({ status: v.literal('SUCCESS'), message: v.optional(v.string()), data });

/** Success envelope for endpoints that return just `{ status, message }`. */
export const MessageResponseSchema = v.object({
  status: v.literal('SUCCESS'),
  message: v.optional(v.string()),
});

export type MessageResponse = v.InferOutput<typeof MessageResponseSchema>;

// ── Request ───────────────────────────────────────────────────────────────────

type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** `undefined` and empty values are dropped rather than sent as "undefined". */
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Caller cancellation (e.g. React Query's signal); combined with the deadline. */
  signal?: AbortSignal;
  /** Extra headers, e.g. a step-up `Authorization: Bearer` token. */
  headers?: Record<string, string>;
  /** Overrides {@link API_BASE_URL}, for routes outside `/api/v1` such as `/health`. */
  baseUrl?: string;
  timeoutMs?: number;
  /** Fetch priority hint; `'low'` for background requests the view doesn't need. */
  priority?: RequestPriority;
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): URL {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

/** `Retry-After` is either delta-seconds or an HTTP date. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    // Non-JSON body (a proxy's HTML error page, for instance).
    if (!response.ok) return undefined;
    throw new ApiError('INVALID_RESPONSE', 'Response is not valid JSON.', {
      status: response.status,
      cause: error,
    });
  }
}

/**
 * Sends the request with the caller's signal combined with a deadline
 * (`AbortSignal.any` + `AbortSignal.timeout`). A caller abort is rethrown
 * as-is; the deadline becomes `TIMEOUT`; anything else is `NETWORK_ERROR`.
 */
async function send(url: URL, label: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, headers, priority, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const hasBody = body !== undefined;

  try {
    return await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        ...DEFAULT_HEADERS,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal,
      ...(priority ? { priority } : {}),
    });
  } catch (error) {
    // `AbortSignal.timeout` rejects with TimeoutError, not AbortError.
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('TIMEOUT', `${label} timed out after ${timeoutMs}ms.`, { cause: error });
    }
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('NETWORK_ERROR', 'Unable to reach the server.', { cause: error });
  }
}

/** The backend's error envelope (or a bare failed status) as an {@link ApiError}. */
function toApiError(response: Response, data: unknown): ApiError {
  const parsed = v.safeParse(ApiErrorBodySchema, data);
  const body = parsed.success ? parsed.output : undefined;
  const fallbackCode = response.ok ? 'REQUEST_FAILED' : `HTTP_${response.status}`;

  return new ApiError(
    body?.code ?? fallbackCode,
    body?.message ?? `Request failed with status ${response.status}.`,
    {
      status: response.status,
      issues: body?.issues,
      requestId: body?.requestId,
      retryAfter: parseRetryAfter(response.headers.get('Retry-After')),
    },
  );
}

const isErrorBody = (data: unknown): boolean => v.is(ApiErrorBodySchema, data);

/**
 * The only way services talk to the backend. Sends the request, then decodes
 * the response against `schema` so callers get a validated, typed body or a
 * thrown {@link ApiError} — never a raw `Response`.
 *
 * Cancellations by the caller (React Query aborting a stale request) are
 * rethrown untouched as `AbortError`; the client's own deadline surfaces as
 * `ApiError('TIMEOUT')`.
 */
export async function request<S extends v.GenericSchema>(
  schema: S,
  options: RequestOptions,
): Promise<v.InferOutput<S>> {
  const url = buildUrl(options.baseUrl ?? API_BASE_URL, options.path, options.query);
  const label = `${options.method ?? 'GET'} ${url.pathname}`;

  const response = await send(url, label, options);
  if (isDev) console.debug(`[api] ${response.status} ${label}`);
  if (response.status === 401) onUnauthorized?.();

  const data = await readJson(response);
  if (!response.ok || isErrorBody(data)) throw toApiError(response, data);

  const result = v.safeParse(schema, data);
  if (!result.success) {
    console.error(
      `[${label}] response validation failed`,
      JSON.stringify(
        v.flatten(result.issues as [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]).nested,
        null,
        2,
      ),
    );
    throw new ApiError('INVALID_RESPONSE', 'Response does not match the expected shape.', {
      status: response.status,
    });
  }

  return result.output;
}
