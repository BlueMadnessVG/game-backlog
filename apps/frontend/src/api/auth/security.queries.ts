import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authKeys } from './auth.queries';
import { securityService } from './security.service';

import type { CreateApiTokenInput } from '@repo/shared';

/**
 * Hooks for the security endpoints (API tokens, TOTP, step-up). No screen
 * uses them yet. A 403 with `ApiError.code === 'STEP_UP_REQUIRED'` means the
 * caller must run `useStepUp` first and pass the returned token.
 */

export function useApiTokens() {
  return useQuery({
    queryKey: authKeys.apiTokens(),
    queryFn: ({ signal }) => securityService.listApiTokens(signal),
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, stepUpToken }: { input: CreateApiTokenInput; stepUpToken?: string }) =>
      securityService.createApiToken(input, stepUpToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.apiTokens() }),
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => securityService.revokeApiToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.apiTokens() }),
  });
}

export function useTotpEnrollStart() {
  return useMutation({
    mutationFn: (stepUpToken?: string) => securityService.startTotpEnroll(stepUpToken),
  });
}

export function useTotpEnrollConfirm() {
  return useMutation({
    mutationFn: ({ code, stepUpToken }: { code: string; stepUpToken?: string }) =>
      securityService.confirmTotpEnroll(code, stepUpToken),
  });
}

export function useStepUp() {
  return useMutation({
    mutationFn: (code: string) => securityService.stepUp(code),
  });
}
