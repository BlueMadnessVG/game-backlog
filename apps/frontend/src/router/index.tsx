import { createRouter } from '@tanstack/react-router';

import { rootRoute } from './root';

import { libraryRoute } from '@/features/Library/router/Library.route';

const routeTree = rootRoute.addChildren([libraryRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
