import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  env: { VITE_APP_ENV: 'test', VITE_API_URL: 'http://api.test/' },
}));

const { ApiError, API_BASE_URL, envelope, request, setUnauthorizedHandler } = await import(
  '../api.client'
);

const DataSchema = envelope(v.object({ name: v.string() }));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const fetchMock = vi.fn<typeof fetch>();

/** URL and init of the first fetch call. */
function firstCall(): { url: string; init: RequestInit; headers: Record<string, string> } {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error('fetch was not called');
  const [input, init = {}] = call;
  const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
  return { url, init, headers: init.headers as Record<string, string> };
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('request', () => {
  it('builds the URL, drops empty query values and sends credentials + CSRF header', async () => {
    fetchMock.mockResolvedValue(json({ status: 'SUCCESS', data: { name: 'ok' } }));

    const result = await request(DataSchema, {
      path: '/library/games',
      query: { limit: 50, title: '', status: undefined, platform: 'steam' },
    });

    expect(result.data.name).toBe('ok');
    const { url, init, headers } = firstCall();
    expect(API_BASE_URL).toBe('http://api.test/api/v1');
    expect(url).toBe('http://api.test/api/v1/library/games?limit=50&platform=steam');
    expect(init.credentials).toBe('include');
    expect(headers['X-Request-With']).toBe('frontend');
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('serialises a JSON body and sets Content-Type', async () => {
    fetchMock.mockResolvedValue(json({ status: 'SUCCESS', data: { name: 'ok' } }));

    await request(DataSchema, { method: 'POST', path: '/auth/login', body: { email: 'a@b.c' } });

    const { init, headers } = firstCall();
    expect(init.body).toBe('{"email":"a@b.c"}');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('turns the error envelope into an ApiError with issues', async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          status: 'ERROR',
          code: 'VALIDATION_FAILED',
          message: 'Bad input',
          issues: [{ path: 'platform', message: 'Invalid platform' }],
        },
        { status: 400 },
      ),
    );

    const error = await request(DataSchema, { path: '/x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
      message: 'Bad input',
      issues: [{ path: 'platform', message: 'Invalid platform' }],
    });
  });

  it('reads Retry-After on rate-limit errors', async () => {
    fetchMock.mockResolvedValue(
      json(
        { status: 'ERROR', code: 'PROVIDER_RATE_LIMITED', message: 'Slow down' },
        { status: 503, headers: { 'Retry-After': '60' } },
      ),
    );

    await expect(request(DataSchema, { path: '/x' })).rejects.toMatchObject({
      code: 'PROVIDER_RATE_LIMITED',
      retryAfter: 60,
    });
  });

  it('falls back to HTTP_<status> for a non-JSON error body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(request(DataSchema, { path: '/x' })).rejects.toMatchObject({
      code: 'HTTP_502',
      status: 502,
    });
  });

  it('reports a 401 to the unauthorized handler', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(
      json({ status: 'ERROR', code: 'UNAUTHORIZED', message: 'No session' }, { status: 401 }),
    );

    await expect(request(DataSchema, { path: '/auth/me' })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('maps a fetch TypeError to NETWORK_ERROR and keeps the cause', async () => {
    const cause = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(cause);

    const error = await request(DataSchema, { path: '/x' }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'NETWORK_ERROR' });
    expect((error as Error).cause).toBe(cause);
  });

  it('maps the client deadline to TIMEOUT', async () => {
    const timeout = new DOMException('signal timed out', 'TimeoutError');
    fetchMock.mockRejectedValue(timeout);

    const error = await request(DataSchema, { path: '/x', timeoutMs: 10 }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'TIMEOUT' });
    expect((error as Error).cause).toBe(timeout);
  });

  it('rethrows a caller abort untouched', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    fetchMock.mockRejectedValue(abort);

    await expect(
      request(DataSchema, { path: '/x', signal: new AbortController().signal }),
    ).rejects.toBe(abort);
  });

  it('throws INVALID_RESPONSE when the body does not match the schema', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(json({ status: 'SUCCESS', data: { name: 42 } }));

    await expect(request(DataSchema, { path: '/x' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    spy.mockRestore();
  });

  it('uses baseUrl for routes outside /api/v1', async () => {
    fetchMock.mockResolvedValue(json({ status: 'SUCCESS', data: { name: 'ok' } }));

    await request(DataSchema, { baseUrl: 'http://api.test', path: '/health' });

    expect(firstCall().url).toBe('http://api.test/health');
  });
});
