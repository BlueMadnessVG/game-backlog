import { createRouter } from '@tanstack/react-router';

import { rootRoute } from './root';

import { heroRoute } from '@/pages/HeroPage/router/Hero.route';
import { libraryRoute } from '@/pages/Library/router/Library.route';

const routeTree = rootRoute.addChildren([libraryRoute, heroRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
