import { useQuery } from '@tanstack/react-query';

import { authService } from './auth.service';

import type { OAuthProvider } from '@repo/shared';

export const authKeys = {
  all: ['auth'] as const,
  providers: () => [...authKeys.all, 'providers'] as const,
  apiTokens: () => [...authKeys.all, 'api-tokens'] as const,
};

/**
 * The social providers configured on the backend. Static for the lifetime of
 * a deploy, so it is fetched once and never considered stale.
 */
export function useAuthProviders(): {
  providers: OAuthProvider[] | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: authKeys.providers(),
    queryFn: ({ signal }) => authService.providers(signal),
    staleTime: Infinity,
  });

  return { providers: data, isLoading };
}
