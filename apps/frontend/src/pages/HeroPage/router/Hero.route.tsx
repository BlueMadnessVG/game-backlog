import { createRoute, lazyRouteComponent } from '@tanstack/react-router';

import { rootRoute } from '@/router/root';

export const heroRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hero',
  component: lazyRouteComponent(() => import('@/pages/HeroPage/Hero.page')),
});
