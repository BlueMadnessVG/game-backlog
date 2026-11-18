import {
  ApiTokensResponseSchema,
  CreateApiTokenResultSchema,
  StepUpResultSchema,
  TotpEnrollStartResultSchema,
  type ApiToken,
  type CreateApiTokenInput,
  type CreateApiTokenResult,
  type StepUpResult,
  type TotpEnrollStartResult,
} from '@repo/shared';

import { envelope, MessageResponseSchema, request, type MessageResponse } from '../api.client';

/**
 * A step-up token from `POST /auth/step-up` is a 5-minute Bearer credential.
 * Callers hold it in memory (component state) only — never localStorage —
 * and pass it to the step-up-gated calls below.
 */
const bearer = (stepUpToken?: string): Record<string, string> | undefined =>
  stepUpToken ? { Authorization: `Bearer ${stepUpToken}` } : undefined;

export const securityService = {
  // ── API tokens ──────────────────────────────────────────────────────────────

  /**
   * `POST /auth/api-tokens` — session only; needs a step-up token when the
   * account has TOTP enrolled (else 403 `STEP_UP_REQUIRED`). The plaintext
   * `token` is in this response only.
   */
  createApiToken: async (
    input: CreateApiTokenInput,
    stepUpToken?: string,
  ): Promise<CreateApiTokenResult> => {
    const response = await request(envelope(CreateApiTokenResultSchema), {
      method: 'POST',
      path: '/auth/api-tokens',
      body: input,
      headers: bearer(stepUpToken),
    });
    return response.data;
  },

  /** `GET /auth/api-tokens` — the user's tokens (prefix only, never the secret). */
  listApiTokens: async (signal?: AbortSignal): Promise<ApiToken[]> => {
    const response = await request(ApiTokensResponseSchema, { path: '/auth/api-tokens', signal });
    return response.data;
  },

  /** `DELETE /auth/api-tokens/:id` */
  revokeApiToken: (id: string): Promise<MessageResponse> =>
    request(MessageResponseSchema, {
      method: 'DELETE',
      path: `/auth/api-tokens/${encodeURIComponent(id)}`,
    }),

  // ── TOTP ────────────────────────────────────────────────────────────────────

  /** `POST /auth/totp/enroll/start` — returns the secret once; step-up if already enrolled. */
  startTotpEnroll: async (stepUpToken?: string): Promise<TotpEnrollStartResult> => {
    const response = await request(envelope(TotpEnrollStartResultSchema), {
      method: 'POST',
      path: '/auth/totp/enroll/start',
      headers: bearer(stepUpToken),
    });
    return response.data;
  },

  /** `POST /auth/totp/enroll/confirm` — enables TOTP once a valid code is shown. */
  confirmTotpEnroll: (code: string, stepUpToken?: string): Promise<MessageResponse> =>
    request(MessageResponseSchema, {
      method: 'POST',
      path: '/auth/totp/enroll/confirm',
      body: { code },
      headers: bearer(stepUpToken),
    }),

  /** `POST /auth/step-up` — trades a TOTP code for a 5-minute step-up token. */
  stepUp: async (code: string): Promise<StepUpResult> => {
    const response = await request(envelope(StepUpResultSchema), {
      method: 'POST',
      path: '/auth/step-up',
      body: { code },
    });
    return response.data;
  },
};
