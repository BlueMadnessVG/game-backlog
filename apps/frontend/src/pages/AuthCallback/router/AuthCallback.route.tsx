import { createRoute, lazyRouteComponent } from '@tanstack/react-router';

import { rootRoute } from '@/router/root';

export const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'auth/callback',
  component: lazyRouteComponent(() => import('@/pages/AuthCallback/AuthCallback.page')),
});
