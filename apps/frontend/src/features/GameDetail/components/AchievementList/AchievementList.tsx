import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';

import { AchievementListInner } from '../AchievementListInner/AchievementListInner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementListProps {
  gameId: string;
  queryClient: QueryClient;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AchievementList: React.FC<AchievementListProps> = ({ gameId, queryClient }) => (
  <QueryClientProvider client={queryClient}>
    <AchievementListInner gameId={gameId} />
  </QueryClientProvider>
);
