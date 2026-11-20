import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountsService } from './accounts.service';

import type { PlatformRoute } from '@repo/shared';

export const accountKeys = {
  all: ['accounts'] as const,
};

/** Which of Steam / Xbox / PSN the user has linked. */
export function useLinkedAccounts() {
  return useQuery({
    queryKey: accountKeys.all,
    queryFn: ({ signal }) => accountsService.getLinked(signal),
  });
}

/** Unlinks one platform, then refreshes the linked-accounts list. */
export function useUnlinkAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (platform: PlatformRoute) => accountsService.unlink(platform),
    meta: { errorMessage: 'Could not unlink the account.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
