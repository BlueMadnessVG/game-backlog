import { useQuery } from '@tanstack/react-query';
import * as v from 'valibot';

import { API_ORIGIN, request } from './api.client';

/** `GET /health` — sits at the origin root, outside `/api/v1`, and has no SUCCESS envelope. */
const HealthSchema = v.object({
  status: v.literal('OPERATIONAL'),
  uptime: v.number(),
  timestamp: v.string(),
});

export type Health = v.InferOutput<typeof HealthSchema>;

export const healthService = {
  check(signal?: AbortSignal): Promise<Health> {
    return request(HealthSchema, {
      baseUrl: API_ORIGIN,
      path: '/health',
      signal,
      // A background check the current view never waits on.
      priority: 'low',
      timeoutMs: 5_000,
    });
  },
};

/** Backend liveness. Not used by a screen yet. */
export function useHealth(options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => healthService.check(signal),
    staleTime: 30_000,
    retry: false,
    refetchInterval: options.refetchInterval,
  });
}
