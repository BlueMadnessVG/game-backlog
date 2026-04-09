import { createRootRoute } from '@tanstack/react-router';

import { RootComponent } from './components/Root';

import GlobalLoadingFallback from '@/common/components/ui/GlobalLoading/GlobalLoading.fallback';

export const rootRoute = createRootRoute({
  component: RootComponent,
  pendingComponent: GlobalLoadingFallback,
  notFoundComponent: () => <div>404 - Not Found</div>,
});
