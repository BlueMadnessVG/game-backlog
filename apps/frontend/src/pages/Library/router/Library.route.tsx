import { createRoute, lazyRouteComponent } from '@tanstack/react-router';

import { rootRoute } from '@/router/root';

export const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'library',
  component: lazyRouteComponent(() => import('@/pages/Library/Library.page')),
});
