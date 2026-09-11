import { createRoute, lazyRouteComponent } from '@tanstack/react-router';

import { rootRoute } from '@/router/root';

export const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'auth',
  component: lazyRouteComponent(() => import('@/pages/Auth/Auth.page')),
});