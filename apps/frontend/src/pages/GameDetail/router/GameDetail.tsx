import { createRoute, lazyRouteComponent } from '@tanstack/react-router';

import { rootRoute } from '@/router/root';

export const gameDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'games/$id',
  component: lazyRouteComponent(() => import('@/pages/GameDetail/GameDetail.page')),
});
