import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import * as v from 'valibot';

import { env } from '@/env';

// ── Transport ─────────────────────────────────────────────────────────────────

/**
 * The session is an HttpOnly cookie owned by the browser, so the client only
 * has to send it (`withCredentials`) and, because cookie-authenticated
 * mutating requests are CSRF-checked, the `X-Request-With` header.
 */
export const apiClient = axios.create({
  baseURL: `${env.VITE_API_URL.replace(/\/$/, '')}/api/v1`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Request-With': 'frontend',
  },
});

/**
 * Seam to the session owner: the client reports a 401, whoever holds the
 * session decides what to do. Keeps this module free of store imports.
 */
let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null): void => {
  onUnauthorized = handler;
};

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(`📡 [OUTGOING] ${config.method?.toUpperCase()} -> ${config.url}`);
    return config;
  },
  (error: Error) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ [INCOMING] ${response.status} <- ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    if (axios.isCancel(error)) {
      console.log('🚫 [CANCELED] Request aborted by controller');
      return Promise.reject(error);
    }

    if (error?.response?.status === 401) {
      onUnauthorized?.();
    }

    return Promise.reject(error);
  },
);

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * The one error the client throws. `code` is stable and safe to branch on:
 * the backend's own code (e.g. `GAME_NOT_FOUND`) when it sent one, otherwise
 * `NETWORK_ERROR`, `INVALID_RESPONSE` or `HTTP_<status>`.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Codes whose `message` is ours, not the server's, and not meant for users. */
export const CLIENT_ERROR_CODES = ['NETWORK_ERROR', 'INVALID_RESPONSE'] as const;

// ── Envelope ──────────────────────────────────────────────────────────────────

/** Every failure leaves the backend as `{ status: "ERROR", code, message }`. */
const ErrorBodySchema = v.object({
  status: v.literal('ERROR'),
  code: v.optional(v.string()),
  message: v.optional(v.string()),
});

/** Success envelope for endpoints that return just `{ status, data }`. */
export const envelope = <S extends v.GenericSchema>(data: S) =>
  v.object({ status: v.literal('SUCCESS'), data });

/** Success envelope for endpoints that return just `{ status, message }`. */
export const MessageResponseSchema = v.object({
  status: v.literal('SUCCESS'),
  message: v.optional(v.string()),
});

export type MessageResponse = v.InferOutput<typeof MessageResponseSchema>;

// ── Request ───────────────────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  /** `undefined` and empty values are dropped rather than sent as "undefined". */
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

function cleanQuery(query: RequestOptions['query']): Record<string, string | number> | undefined {
  if (!query) return undefined;

  const entries = Object.entries(query).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '',
  );
  return Object.fromEntries(entries);
}

function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError('UNKNOWN', error instanceof Error ? error.message : 'Unexpected error');
  }

  const response = error.response;
  if (!response) {
    return new ApiError('NETWORK_ERROR', 'Unable to reach the server.');
  }

  const parsed = v.safeParse(ErrorBodySchema, response.data);
  const body = parsed.success ? parsed.output : undefined;
  return new ApiError(
    body?.code ?? `HTTP_${response.status}`,
    body?.message ?? error.message,
    response.status,
  );
}

/**
 * The only way services talk to the backend. Sends the request, then decodes
 * the response against `schema` so callers get a validated, typed body or a
 * thrown {@link ApiError} — never a raw axios response.
 *
 * Cancellations (React Query aborting a stale request) are rethrown untouched.
 */
export async function request<S extends v.GenericSchema>(
  schema: S,
  { method = 'GET', path, query, body, signal }: RequestOptions,
): Promise<v.InferOutput<S>> {
  let status: number;
  let data: unknown;

  try {
    const response = await apiClient.request<unknown>({
      method,
      url: path,
      params: cleanQuery(query),
      data: body,
      signal,
    });
    status = response.status;
    data = response.data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }

  const failure = v.safeParse(ErrorBodySchema, data);
  if (failure.success) {
    throw new ApiError(
      failure.output.code ?? 'REQUEST_FAILED',
      failure.output.message ?? 'Request failed.',
      status,
    );
  }

  const result = v.safeParse(schema, data);
  if (!result.success) {
    console.error(
      `[${method} ${path}] response validation failed`,
      JSON.stringify(
        v.flatten(result.issues as [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]).nested,
        null,
        2,
      ),
    );
    throw new ApiError('INVALID_RESPONSE', 'Response does not match the expected shape.', status);
  }

  return result.output;
}
